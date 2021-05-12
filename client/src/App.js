import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import Header from "./Header";
import ItemCard from "./ItemCard";
import FilterButton from "./FilterButton";
import { Container, Row, Col, Dropdown } from "react-bootstrap";

const categories = [
  "jackets",
  "shirts",
  "tops-sweaters",
  "sweatshirts",
  "pants",
  "shorts",
  "t-shirts",
  "hats",
  "bags",
  "accessories",
  "skate",
  "shoes",
];

function App() {
  const [weeks, setWeeks] = useState([]);
  const [drops, setDrops] = useState([]);
  const [sorting, setSorting] = useState("profit");
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingContent, setLoadingContent] = useState(false);
  const [filters, setFilters] = useState([]);
  const [filteredDrops, setFilteredDrops] = useState([]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      return window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleSorting = (sortType) => {
    setSorting(sortType);

    // setFilteredDrops((prev) =>
    //   prev.sort((a, b) => {
    //     switch (sortType) {
    //       case "lowestAsk":
    //       case "profit":
    //       case "asks":
    //       case "bids":
    //         console.log(
    //           a.stockx.average[sortType],
    //           " | ",
    //           b.stockx.average[sortType]
    //         );
    //         if (a.stockx == null || a.stockx.average[sortType] == null) {
    //           return 1;
    //         } else if (b.stockx == null || b.stockx.average[sortType] == null) {
    //           return -1;
    //         } else {
    //           return b.stockx.average[sortType] - a.stockx.average[sortType];
    //         }
    //       case "name":
    //       case "category":
    //         return a[sortType].localeCompare(b[sortType]);
    //       default:
    //         break;
    //     }
    //   })
    // );
  };

  const filterNewData = (data) => {
    if (filters.length === 0) {
      setFilteredDrops((prev) => [...prev, ...data]);
    } else {
      setFilteredDrops((prev) => [
        ...prev,
        ...data.filter(
          (item) =>
            filters.indexOf(item.category) > -1 ||
            filters.indexOf("Week " + item.week) > -1
        ),
      ]);
    }
  };

  const handleFilter = (category, type) => {
    const week = type != undefined && type === "week";

    const index = filters.indexOf(category);

    if (index > -1) {
      if (filters.length === 1) {
        setFilters([]);
        setFilteredDrops(drops);
      } else {
        setFilters((prev) => {
          prev.splice(index, 1);
          return prev;
        });

        setFilteredDrops((prev) =>
          prev.filter((item) =>
            week
              ? Number(item.week) !== Number(category.split("Week")[1])
              : item.category !== category
          )
        );
      }
    } else {
      if (filters.length === 0) {
        const arrlen = filters.push(category);
        setFilteredDrops(
          drops.filter((item) =>
            week
              ? Number(item.week) === Number(category.split("Week")[1])
              : item.category === filters[arrlen - 1]
          )
        );
      } else {
        const arrlen = filters.push(category);
        setFilteredDrops((prev) => [
          ...prev,
          ...drops.filter((item) =>
            week
              ? Number(item.week) === Number(category.split("Week")[1])
              : item.category === filters[arrlen - 1]
          ),
        ]);
      }
    }
  };

  const handleScroll = () => {
    if (
      window.innerHeight + document.documentElement.scrollTop ===
      document.scrollingElement.scrollHeight
    ) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  useEffect(async () => {
    const responseDropList = await axios.get(
      `https://www.supmonitor.lubomirdlhy.sk/api/droplist`
    );
    setWeeks(responseDropList.data.data.map((item) => "Week " + item.week));
  }, []);

  useEffect(() => {
    const getData = async () => {
      const response = await axios.get(
        `https://www.supmonitor.lubomirdlhy.sk/api/drop/all?sort=profit&page=${currentPage}`
      );
      setDrops((prev) => [...prev, ...response.data.data]);
      filterNewData(response.data.data);
    };

    getData();
  }, [currentPage]);

  return (
    <div className="App" onScroll={handleScroll}>
      <Header />
      {/* <OptionContainer/> */}

      <Container fluid>
        <div className="d-flex flex-row justify-content-center mb-3">
          {categories.map((cat, index) => (
            <FilterButton
              cat={cat}
              key={index}
              handleClick={(category) => handleFilter(category)}
            />
          ))}
        </div>

        <div className="d-flex flex-row justify-content-center mb-3">
          {weeks.map((cat, index) => (
            <FilterButton
              cat={cat}
              key={index}
              handleClick={(category) => handleFilter(category, "week")}
            />
          ))}
        </div>

        <Container className={"d-flex justify-content-between mb-3"}>
          <div>
            <span>Results: </span>
            <span className="h6">{filteredDrops.length}</span>
          </div>

          <Dropdown>
            <Dropdown.Toggle
              id="dropdown-item-button"
              size="sm"
              variant="white"
            >
              {sorting}
            </Dropdown.Toggle>

            <Dropdown.Menu>
              <Dropdown.Item
                onSelect={(eventKey) => {
                  handleSorting(eventKey);
                }}
                as="button"
                className={"btn btn-light"}
                eventKey="profit"
              >
                Profit
              </Dropdown.Item>
              <Dropdown.Item
                onSelect={(eventKey) => {
                  handleSorting(eventKey);
                }}
                as="button"
                className={"btn btn-light"}
                eventKey="lowestAsk"
              >
                Resell
              </Dropdown.Item>
              <Dropdown.Item
                onSelect={(eventKey) => {
                  handleSorting(eventKey);
                }}
                as="button"
                className={"btn btn-light"}
                eventKey="name"
              >
                Name
              </Dropdown.Item>
              <Dropdown.Item
                onSelect={(eventKey) => {
                  handleSorting(eventKey);
                }}
                as="button"
                className={"btn btn-light"}
                eventKey="category"
              >
                Category
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </Container>
      </Container>
      <Container>
        <Row className="justify-content-center">
          {filteredDrops &&
            filteredDrops.map((item, index) => (
              <Col key={index} xs={10} sm={6} lg={4} xl={3} className="mb-5">
                <ItemCard data={item} />
              </Col>
            ))}
          <Col className="mb-5"></Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;
