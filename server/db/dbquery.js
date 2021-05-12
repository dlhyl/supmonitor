import pool from "./pool.js";

export default {
  query(quertText, params) {
    return new Promise((resolve, reject) => {
      pool
        .query(quertText, params)
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    });
  },
};
