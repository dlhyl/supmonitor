import dbquery from "./db/dbquery.js";

const update = async () => {
  return new Promise(async (res, rej) => {
    try {
      const { rows } = await dbquery.query("select * from supitems;");

      for (var i in rows) {
        const itemS = rows[i].stockx;

        if (itemS == null) {
          continue;
        }

        let newStockx = {};
        let oldAverage = itemS.average;
        newStockx.count = itemS.count;
        newStockx.items = itemS.items;
        newStockx.average = oldAverage;
        newStockx.latestAverage = oldAverage[oldAverage.length - 1];

        await dbquery.query(
          "UPDATE supitems set stockx = $1 where sc_id = $2;",
          [newStockx, rows[i].sc_id]
        );
      }

      const resp = await dbquery.query("select * from supitems;");
      res(
        resp.rows
          // .sort((a, b) => {
          //   if (
          //     b.stockx.average.profit == null ||
          //     isNaN(b.stockx.average.profit)
          //   )
          //     return -1;
          //   else if (
          //     a.stockx.average.profit == null ||
          //     isNaN(a.stockx.average.profit)
          //   )
          //     return 1;
          //   else return b.stockx.average.profit - a.stockx.average.profit;
          // })
          .map((it) => {
            return [it.name, it.stockx.average];
          })
          .slice(0, 5)
      );
    } catch (error) {
      rej(error);
    }
  });
};

update().then(console.log).catch(console.error);
