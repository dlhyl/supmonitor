import puppeteer from "puppeteer";
import axios from "axios";
import cheerio from "cheerio";
import http from "http";
import dbquery from "./db/dbquery.js";
import express from "express";
import cors from "cors";
import cron from "node-cron";

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
      let linkToLatest = await page.evaluate(() => {
        return (
          window.location.protocol +
          "//" +
          window.location.host +
          document.querySelector("#box-latest > a").getAttribute("href")
        );
      });

      await console.log(linkToLatest);

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
        let dropDetails =
          mainContainer.querySelector("div.sc-moreinfos") == undefined
            ? ""
            : mainContainer.querySelector("div.sc-moreinfos").textContent;

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

      await console.log(latestDropData);

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

const getStockxProductsInfo = (searchQuery, releaseDate, retailPrice) => {
  return new Promise(async (res, rej) => {
    try {
      await console.log(
        "https://stockx.com/api/browse?&sort=release_date&order=DESC&currency=USD&_search=" +
          encodeURI(searchQuery) +
          "&dataType=product"
      );
      const { data } = await axios.get(
        "https://stockx.com/api/browse?&sort=release_date&order=DESC&currency=USD&_search=" +
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
        items: data.Products.filter(
          (item) => item.releaseTime - releaseDate + 170000 > 0
        ).map((item) => {
          return {
            rd: item.releaseTime - releaseDate,
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

      info.count = info.items.length;

      let count = 0;
      let average = {
        asks: 0,
        bids: 0,
        sold: 0,
        lowestAsk: 0,
        sold3days: 0,
        highestBid: 0,
        lowestSold: 0,
        highestSold: 0,
        priceChange: 0,
        averageSoldPrice: 0,
        priceChangePercentage: 0,
      };
      for (const averageItem in average) {
        info.items.map((item) => {
          if (
            item.price[averageItem] != null ||
            !isNaN(item.price[averageItem])
          ) {
            average[averageItem] += item.price[averageItem];
            count++;
          }
        });

        average[averageItem] = Number(
          (average[averageItem] / count).toFixed(2)
        );
        count = 0;
      }

      average.profit = Number(
        (average.lowestAsk - Number(retailPrice)).toFixed(2)
      );

      average.timestamp = Number(Date.now());

      info.latestAverage = average;

      info.average = [];
      info.average.push(average);
      res(info);
    } catch (error) {
      rej(error);
    }
  });
};

const getNewPrices = async () => {
  const response = await dbquery.query("select week,date from supdrop;");

  for (const row of response.rows) {
    const week = row.week;
    const releaseDate = new Date(row.date).getTime() / 1000;

    const { rows } = await dbquery.query(
      "select * from supitems where week = " + week + " AND stockx is null;"
    );

    for (var i in rows) {
      console.log(
        rows[i].name.replace(/(?![a-zA-Z0-9])[^\s\.()\/]/g, "") +
          ", est: " +
          rows[i].colors.length
      );

      let name = rows[i].name.replace(/(?![a-zA-Z0-9])[^\s\.()\/]/g, "");

      if (name.toLowerCase().indexOf("supreme") === -1)
        name = "Supreme " + name;

      const info = await getStockxProductsInfo(
        name,
        releaseDate,
        rows[i].prices.usd
      );
      console.log(info.count + " res");
      const response = await dbquery.query(
        "UPDATE supitems SET stockx = $1 WHERE name = $2 returning *;",
        [info, rows[i].name]
      );
      await console.log();
      await sleep(30000);
    }
  }
};

const updatePrices = async () => {
  const items = await dbquery.query(
    "SELECT * FROM supitems where stockx->'items' is not null;"
  );

  for (const row of items.rows) {
    let originalStockx = row.stockx;
    let average = {
      asks: 0,
      bids: 0,
      sold: 0,
      lowestAsk: 0,
      sold3days: 0,
      highestBid: 0,
      lowestSold: 0,
      highestSold: 0,
      priceChange: 0,
      averageSoldPrice: 0,
      priceChangePercentage: 0,
    };

    for (const itemIndex in row.stockx.items) {
      const productURL = `https://stockx.com/api/products/${originalStockx.items[itemIndex].id}/market?currency=USD?country=SK`;
      const { data } = await axios.get(productURL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.3",
        },
      });

      originalStockx.items[itemIndex].price = {
        lowestAsk: data.Market.lowestAsk,
        asks: data.Market.numberOfAsks,
        highestBid: data.Market.highestBid,
        bids: data.Market.numberOfBids,
        highestSold: data.Market.annualHigh,
        lowestSold: data.Market.annualLow,
        sold: data.Market.deadstockSold,
        averageSoldPrice: data.Market.averageDeadstockPrice,
        sold3days: data.Market.salesLast72Hours,
        priceChange: data.Market.changeValue,
        priceChangePercentage: data.Market.changePercentage,
      };

      for (const avgItem in average) {
        average[avgItem] += originalStockx.items[itemIndex].price[avgItem];
      }
      await sleep(10000);
    }
    for (const avgItem in average) {
      average[avgItem] /= originalStockx.count;
    }

    average.profit = Number(
      (average.lowestAsk - Number(row.prices.usd)).toFixed(2)
    );
    average.timestamp = Number(Date.now());

    originalStockx.average.push(average);
    originalStockx.latestAverage = average;

    await console.log(
      row.name +
        (await dbquery.query(
          "UPDATE supitems set stockx = $1 where sc_id = $2;",
          [originalStockx, row.sc_id]
        ))
    );
  }
};

cron.schedule("0 4 * * *", function () {
  console.log("Updating existing data!");
  updatePrices();
});

cron.schedule("0 20 * * 4", function () {
  console.log("Getting new drop data!");
  getLatestDropItems().then(() => {
    getNewPrices();
  });
});

updatePrices();
