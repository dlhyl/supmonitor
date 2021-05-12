import React from "react";
import { Card } from "react-bootstrap";

export default ({ data }) => {
  return (
    <Card className="h-100 px-2 shadow-sm bg-white rounded">
      <Card.Img variant="top" src={data.images[0]} />
      <Card.Body className="d-flex p-2 flex-column">
        <Card.Title className="mb-0 h6 font-weight-bold item-title">
          {data.name}
        </Card.Title>
        <div className="row mb-0">
          <div className="col d-flex flex-column">
            <span className="">Retail</span>
            <span className="h6">${Math.round(Number(data.prices.usd))}</span>
          </div>
          <div className="col d-flex flex-column">
            <span className="">Resell</span>
            <span
              className={`h6 ${
                Math.round(Number(data.stockx.latestAverage.lowestAsk)) > 0
                  ? "text-success"
                  : "text-danger"
              }`}
            >
              ${Math.round(Number(data.stockx.latestAverage.lowestAsk))}
            </span>
          </div>
          <div className="col d-flex flex-column">
            <span className="">Profit</span>
            <span
              className={`h6 ${
                Math.round(Number(data.stockx.latestAverage.profit)) > 0
                  ? "text-success"
                  : "text-danger"
              }`}
            >
              ${Math.round(Number(data.stockx.latestAverage.profit))}
            </span>
          </div>
          <div className="col d-flex flex-column"></div>
        </div>
        <div className="row">
          <div className="col d-flex flex-column">
            <span className="small">Last update</span>
            <span className="small font-weight-bold">
              {new Date(
                data.stockx.latestAverage.timestamp
              ).toLocaleDateString()}
            </span>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};
