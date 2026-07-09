const fetch = require("node-fetch");
const { getStore } = require("@netlify/blobs");

const PT_MINDER = {
  "Damian Pogson":829,"Sam Brunt":648,"Baljit Sahota":647,"Nicola Heath":645,
  "Satnam Seehra":636,"April Philips":633,"Hannah Osborne":614,"Sarah Baugh":583,
  "Sam Averall":552,"Alexa Phipson":468,"Victoria Hubball":425,"Sonia Dulay":390,
  "Sarah Austin":390,"Stacey Stockton":377,"Karen Jackson":368,"Michelle King":357,
  "Dawn Dixon":342,"Leanne Tighe":342,"Chas Seehra":336,"Dawn Davis":318,
  "Emily Roberts":310,"Amrit Dulay":293,"Joanne Hathaway":287,"Paul Shoker":281,
  "Trevor Rawlins":280,"Paul Ralph":266,"Caroline Williamson":253,"Jo Dimmock":248,
  "Kate Bailey":239,"Natalie Lewis":233,"Seema Faulkner":226,"Liz Hurst":219,
  "Julie Hadley":219,"Alison Lees":216,"Jane Shearwood":209,"Helen Williams":194,
  "Claire Devonport":194,"Cara Doherty":194,"Emma Foster":193,"Richard Cahalane":193,
  "Joanne Clewes":191,"Joanne Hume-Billingham":185,"Jo Hughes":183,"Paula Beddard":181,
  "Yvonne Price":178,"Nick Roche":166,"Jaynie Berry":163,"Clare Stafford":160,
  "Kelly Guest - Southwick":159,"Trey Kaur":159,"Richard Davis":158,"Julie Street":157,
  "Nikki Price":156,"Rebecca Barnfield":154,"Becky Bradley":149,"Sonia Qaiser":145,
  "Sam Grove":145,"Hollie Carter":145,"Katie Rose":135,"Rachel Rolands":134,
  "Dave Shoker":132,"Nigel Meehan":131,"Libby Robinson":125,"Amanda Owen":120,
  "Simran Kaur":116,"Diane Williams":116,"Angie Wood":111,"Nina Stafford":110,
  "Lisa Williams":108,"Chris Pile":106,"Louise Harris":101,"Kerry Finnegan":94,
  "Lucy Bayliss":90,"Seema Pabla":86,"Nadia Malik":79,"Sarah Raine":77,
  "Kam Arora":71,"Dawn Humphries":70,"Sam Ryder":70,"Stacey Dingley":67,
  "Kara Sheldon":62,"Mark Whitehouse":62,"Elizabeth Edwards":60,"Chris Roberts":60,
  "Kate Healy":57,"Rebecca Houghton":56,"Lin Betts":50,"Jo Kennett":48,
  "Taran Chana":41,"Robbie Kinsey":35,"Christina Santos":34,"Chloe Fowkes":33,
  "Natalie Hemus":32,"Davinia George":32,"Karen Martin":32,"Susan Bryan":29,
  "Gayle Norton":27,"Jerome Harris":26,"Laura Staten":24,"Shannon Roach":19,
  "Sheree Bate":18,"Simran Hothi":17,"Amanda Cook":13,"Lucie Bissell":9,
  "Tom Bissell":9,"Natalie Armstrong":7,"Rachel Bradley":6,"Pinda Sanghera":3,
  "Ranjit Bhathal":3,
};

const OFFERING_TYPES = new Set([293920, 293937, 293923]);

const GTU_HEADERS = {
  Authorization: `Token ${process.env.GTU_M2M_TOKEN}`,
  "TeamUp-Request-Mode": "provider",
  "TeamUp-Provider-ID": "12086776",
  "Accept": "application/json",
};

async function fetchAllPages(url) {
  let results = [];
  let nextUrl = url;
  while (nextUrl) {
    const res = await fetch(nextUrl, { headers: GTU_HEADERS });
    const data = await res.json();
    results = results.concat(data.results || []);
    nextUrl = data.next || null;
  }
  return results;
}

exports.handler = async (event) => {
  console.log("Background sync started");
  try {
    const store = getStore({
      name: "milestones",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });

    let eventOfferingType = {};
    try {
      const raw = await store.get("event-types");
      if (raw) eventOfferingType = JSON.parse(raw);
    } catch(e) {}

    const [customers, attendances] = await Promise.all([
      fetchAllPages("https://goteamup.com/api/v2/customers?per_page=100"),
      fetchAllPages("https://goteamup.com/api/v2/attendances?per_page=100&status=attended"),
    ]);

    console.log(`Got ${customers.length} customers, ${attendances.length} attendances`);

    const idToName = {};
    for (const c of customers) {
      idToName[c.id] = `${c.first_name} ${c.last_name}`.trim();
    }

    const unknownEventIds = [...new Set(attendances.map(a => a.event))].filter(id => !(id in eventOfferingType));
    console.log(`Looking up ${unknownEventIds.length} new event types`);

    for (let i = 0; i < unknownEventIds.length; i += 10) {
      const batch = unknownEventIds.slice(i, i + 10);
      const evResults = await Promise.all(
        batch.map(id =>
          fetch(`https://goteamup.com/api/v2/events/${id}`, { headers: GTU_HEADERS })
            .then(r => r.json()).catch(() => null)
        )
      );
      for (const ev of evResults) {
        if (ev && ev.id) eventOfferingType[ev.id] = ev.offering_type;
      }
    }

    await store.set("event-types", JSON.stringify(eventOfferingType));

    const attendanceCounts = {};
    for (const a of attendances) {
      if (OFFERING_TYPES.has(eventOfferingType[a.event])) {
        attendanceCounts[a.customer] = (attendanceCounts[a.customer] || 0) + 1;
      }
    }

    const results = Object.entries(PT_MINDER).map(([name, ptm]) => {
      const custId = Object.keys(idToName).find(id => idToName[id] === name);
      const gtu = custId ? (attendanceCounts[parseInt(custId)] || 0) : 0;
      const total = ptm + gtu;
      const lastMilestone = Math.floor(total / 100) * 100;
      const nextMilestone = lastMilestone + 100;
      return { name, ptm, gtu, total, lastMilestone, nextMilestone, toNext: nextMilestone - total };
    });

    for (const [custId, count] of Object.entries(attendanceCounts)) {
      const name = idToName[custId];
      if (name && !PT_MINDER[name] && count > 0) {
        const total = count;
        const lastMilestone = Math.floor(total / 100) * 100;
        const nextMilestone = lastMilestone + 100;
        results.push({ name, ptm: 0, gtu: count, total, lastMilestone, nextMilestone, toNext: nextMilestone - total });
      }
    }

    results.sort((a, b) => a.toNext - b.toNext);

    await store.set("sync-result", JSON.stringify({
      members: results,
      synced_at: new Date().toISOString(),
    }));

    console.log("Background sync complete:", results.length, "members");
  } catch (err) {
    console.error("Background sync error:", err);
  }
};
