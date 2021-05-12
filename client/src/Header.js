import React from "react";
import { Navbar } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDesktop } from "@fortawesome/free-solid-svg-icons";

export default () => {
  return (
    <Navbar className={"shadow p-3 m-2 mb-5 bg-light rounded-lg"}>
      <Navbar.Brand href="/">
        <span className={"px-2"}>SupMonitor</span>
        <FontAwesomeIcon style={{ fontSize: 18 }} icon={faDesktop} />
      </Navbar.Brand>
    </Navbar>
  );
};
