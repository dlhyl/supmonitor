import puppeteer from "puppeteer";
import axios from "axios";
import cheerio from "cheerio";
import http from "http";
import dbquery from "./db/dbquery.js";
import express from "express";
import cors from "cors";
const app = express();
app.use(cors());

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const supUrl =
  "https://www.supremecommunity.com/season/fall-winter2020/droplists/";
const supUrlItemDetail = "https://www.supremecommunity.com/season/itemdetails/";

const openBrowser = () => {
  return new Promise(async (res, rej) => {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-setuid-sandbox",

          "--proxy-server=http://198.148.118.7:3128",
        ],
      });

      const page = await browser.newPage();

      res({ browser, page });
    } catch (error) {
      rej(error);
    }
  });
};

const getLatestDropItems = () => {
  return new Promise(async (res, rej) => {
    try {
      const { browser, page } = await openBrowser();
      await page.goto(supUrl);
      // const linkToLatest = await page.evaluate(() => {
      //   return (
      //     window.location.protocol +
      //     "//" +
      //     window.location.host +
      //     document.querySelector("#box-latest > a").getAttribute("href")
      //   );
      // });

      const linkToLatest =
        "https://www.supremecommunity.com/season/fall-winter2020/droplist/2020-08-20/";

      await page.goto(linkToLatest);
      await page.waitForSelector(".droplist-container");

      let latestDropData = await page.evaluate(() => {
        let weekNo = Number(
          document
            .querySelector("head > title")
            .textContent.match(/Week\s(\d+)/)[1]
        );
        let date = window.location.pathname.match(/.+\/(.+)\/$/)[1];
        let mainContainer = document.querySelector(".droplist-container");
        let dropDetails = mainContainer.querySelector("div.sc-moreinfos")
          .textContent;

        let items = Array.from(
          mainContainer.querySelectorAll("div.masonry__item")
        )
          .filter((item) => item.className.indexOf("filter-ads") === -1)
          .map((item) => {
            let name = item.querySelector("div.card__body > h2").textContent;
            let itemID = Number(
              item.querySelector(".card-details").getAttribute("data-itemid")
            );
            let category = item.getAttribute("data-masonry-filter");
            //let price = item.querySelector(".label-price").innerText;
            let imageURL =
              window.location.protocol +
              "//" +
              window.location.hostname +
              item.querySelector(".prefill-img").getAttribute("src");

            return { name, itemID, category, imageURL };
          });

        return { weekNo, date, dropDetails, items };
      });

      const resp = await dbquery.query(
        "INSERT INTO supdrop (week, date, description) VALUES($1,$2,$3) ON CONFLICT(week) DO NOTHING;",
        [latestDropData.weekNo, latestDropData.date, latestDropData.dropDetails]
      );

      for (var index in latestDropData.items) {
        let item = latestDropData.items[index];

        await page.goto(supUrlItemDetail + item.itemID);

        const pricesArrEH = await page.$x(
          '//h2[contains(text(),"Prices")]/../..'
        );
        const pricesArr = await pricesArrEH[0].$$eval(".price-label", (spans) =>
          spans.map((span) => {
            return span.textContent.match(/\d+/)[0];
          })
        );

        const colorsArrEH = await page.$x(
          '//h2[contains(text(),"Colors")]/../..'
        );
        const colorsArr = await colorsArrEH[0].$$eval(".price-label", (spans) =>
          spans.map((span) => span.textContent)
        );

        const desc = await page.$eval(
          "h2.detail-desc",
          (item) => item.textContent
        );

        const images = await page.$$eval("div#thumbcarousel img", (imgs) =>
          imgs.map(
            (img) =>
              window.location.protocol +
              "//" +
              window.location.hostname +
              img.getAttribute("src")
          )
        );

        item.images = images;
        item.description = desc;
        item.prices = {
          usd: pricesArr[0],
          gbp: pricesArr[1],
          eur: pricesArr[2],
          jpy: pricesArr[3],
        };
        item.colors = colorsArr;

        const respI = await dbquery.query(
          "INSERT INTO supitems (week, name, category, SC_id, description, prices, colors, images) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(sc_id) DO NOTHING;",
          [
            latestDropData.weekNo,
            item.name,
            item.category,
            item.itemID,
            item.description,
            item.prices,
            item.colors,
            item.images,
          ]
        );
        await console.log(index);

        await sleep(1000);
      }

      browser.close();
      res();
    } catch (error) {
      rej(error);
    }
  });
};

const getStockxProductsInfo = (searchQuery) => {
  return new Promise(async (res, rej) => {
    try {
      const { data } = await axios.get(
        "https://stockx.com/api/browse?&currency=EUR&_search=" +
          encodeURI(searchQuery) +
          "&dataType=product",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.3",
          },
        }
      );

      const info = {
        count: data.Pagination.total,
        items: data.Products.map((item) => {
          return {
            id: item.id,
            name_cw: item.title,
            cw: item.colorway,
            name: item.shoe,
            price: {
              lowestAsk: item.market.lowestAsk,
              asks: item.market.numberOfAsks,
              highestBid: item.market.highestBid,
              bids: item.market.numberOfBids,
              highestSold: item.market.annualHigh,
              lowestSold: item.market.annualLow,
              sold: item.market.deadstockSold,
              averageSoldPrice: item.market.averageDeadstockPrice,
              sold3days: item.market.salesLast72Hours,
              priceChange: item.market.changeValue,
              priceChangePercentage: item.market.changePercentage,
            },
          };
        }),
      };

      res(info);
    } catch (error) {
      rej(error);
    }
  });
};

// const { rows } = await dbquery.query(
//   "select * from supitems where stockx is null;"
// );

// for (var i in rows) {
//   console.log(rows[i].name.replace(/(?![a-zA-Z0-9])[^\s\.()]/g, ""));
//   const info = await getStockxProductsInfo(
//     rows[i].name.replace(/(?![a-zA-Z0-9])[^\s\.()]/g, "")
//   );

//   const response = await dbquery.query(
//     "UPDATE supitems SET stockx = $1 WHERE name = $2 returning *;",
//     [info, rows[i].name]
//   );
//   await console.log(i);
//   await sleep(2500);
// }

// //getLatestDropItems().then(console.log).catch(console.error);

app.get("/api/drop", async (req, res) => {
  if (typeof req.query.week != "undefined" && !isNaN(Number(req.query.week))) {
    let limit = 20;
    let page = 1;
    let result;
    let order = null;

    if (
      typeof req.query.limit != "undefined" &&
      !isNaN(Number(req.query.limit))
    ) {
      limit = Number(req.query.limit);
    }
    if (
      typeof req.query.page != "undefined" &&
      !isNaN(Number(req.query.page))
    ) {
      page = Number(req.query.page);
    }
    if (typeof req.query.order != "undefined") {
      switch (req.query.order) {
        case "desc":
          order = "desc";
          break;
        case "asc":
          order = "asc";
          break;
        default:
          break;
      }
    }
    if (typeof req.query.sort != "undefined") {
      let response;
      switch (req.query.sort) {
        case "profit":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week AND supdrop.week = ${Number(
              req.query.week
            )} ORDER BY supitems.stockx->'latestAverage'->'profit' ${
              order == null ? "DESC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;

          break;
        case "sold":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week AND supdrop.week = ${Number(
              req.query.week
            )} ORDER BY supitems.stockx->'latestAverage'->'sold' ${
              order == null ? "DESC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        case "asks":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week AND supdrop.week = ${Number(
              req.query.week
            )} ORDER BY supitems.stockx->'latestAverage'->'asks' ${
              order == null ? "DESC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        case "bids":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week AND supdrop.week = ${Number(
              req.query.week
            )} ORDER BY supitems.stockx->'latestAverage'->'bids' ${
              order == null ? "DESC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        case "resell":
          reponse = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week AND supdrop.week = ${Number(
              req.query.week
            )} ORDER BY supitems.stockx->'latestAverage'->'lowestAsk' ${
              order == null ? "DESC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        case "name":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week AND supdrop.week = ${Number(
              req.query.week
            )} ORDER BY supitems.name ${order == null ? "ASC" : order} offset ${
              (page - 1) * limit
            } limit ${limit};`
          );
          result = response.rows;
          break;
        case "category":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week AND supdrop.week = ${Number(
              req.query.week
            )} ORDER BY supitems.category ${
              order == null ? "ASC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        default:
          break;
      }
      return res
        .status(200)
        .json({ statusCode: 200, status: "Successful request.", data: result });
    }

    const {
      rows,
    } = await dbquery.query(
      `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week AND supdrop.week = $1 offset ${
        (page - 1) * limit
      } limit ${limit};`,
      [Number(req.query.week)]
    );
    result = rows;

    return res
      .status(200)
      .json({ statusCode: 200, status: "Successful request.", data: result });
  }

  return res.status(400).json({ statusCode: 400, status: "Bad request." });
});

app.get("/api/drop/all", async (req, res) => {
  try {
    let limit = 20;
    let page = 1;
    let result;
    let order = null;

    if (
      typeof req.query.limit != "undefined" &&
      !isNaN(Number(req.query.limit))
    ) {
      limit = Number(req.query.limit);
    }
    if (
      typeof req.query.page != "undefined" &&
      !isNaN(Number(req.query.page))
    ) {
      page = Number(req.query.page);
    }
    if (typeof req.query.order != "undefined") {
      switch (req.query.order) {
        case "desc":
          order = "desc";
          break;
        case "asc":
          order = "asc";
          break;
        default:
          break;
      }
    }
    if (typeof req.query.sort != "undefined") {
      let response;
      switch (req.query.sort) {
        case "profit":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week ORDER BY supitems.stockx->'latestAverage'->'profit' ${
              order == null ? "DESC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;

          break;
        case "sold":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week ORDER BY supitems.stockx->'latestAverage'->'sold' ${
              order == null ? "DESC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        case "asks":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week ORDER BY supitems.stockx->'latestAverage'->'asks' ${
              order == null ? "DESC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        case "bids":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week ORDER BY supitems.stockx->'latestAverage'->'bids' ${
              order == null ? "DESC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        case "resell":
          reponse = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week ORDER BY supitems.stockx->'latestAverage'->'lowestAsk' ${
              order == null ? "DESC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        case "name":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week ORDER BY supitems.name ${
              order == null ? "ASC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        case "category":
          response = await dbquery.query(
            `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week ORDER BY supitems.category ${
              order == null ? "ASC" : order
            } offset ${(page - 1) * limit} limit ${limit};`
          );
          result = response.rows;
          break;
        default:
          break;
      }
      return res
        .status(200)
        .json({ statusCode: 200, status: "Successful request.", data: result });
    }

    const { rows } = await dbquery.query(
      `SELECT * FROM supdrop INNER JOIN supitems ON supitems.week = supdrop.week offset ${
        (page - 1) * limit
      } limit ${limit};`
    );
    result = rows;

    return res
      .status(200)
      .json({ statusCode: 200, status: "Successful request.", data: result });
  } catch (error) {
    return res
      .status(400)
      .json({ statusCode: 400, status: "Error.", message: error });
  }
});

app.get("/api/droplist", async (req, res) => {
  try {
    const { rows } = await dbquery.query("Select * from supdrop;");

    return res
      .status(200)
      .json({ statusCode: 200, status: "Successful request.", data: rows });
  } catch (err) {
    return res
      .status(400)
      .json({ statusCode: 400, status: "Error.", message: err });
  }
});

app.listen(5001, () => console.log("Example app listening on port 5001!"));
