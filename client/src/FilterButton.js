import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
export default (props) => {
  const [active, setActive] = useState(false);

  return (
    <button
      onClick={() => {
        setActive((prev) => !prev);
        props.handleClick(props.cat);
      }}
      key={props.index}
      type="button"
      value={props.cat}
      className={`btn btn-sm btn-light mx-1 rounded-pill d-flex flex-row align-items-center no-shadowbox ${
        active ? "btn-active" : "btn-nonactive"
      }`}
      style={{ textTransform: "capitalize", paddingRight: "1.25em" }}
    >
      <FontAwesomeIcon
        style={{ fontSize: "0.85em", marginRight: "0.4em" }}
        icon={faCheck}
        className={`${active ? "visible" : "invisible"}`}
      />
      <span>{props.cat}</span>
    </button>
  );
};
