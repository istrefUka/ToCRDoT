import { LogEntry } from "../main/append_only_log";
import {_encodeEntry, _decodeEntry, Communication, decodeMessage} from "../main/communication";

describe("Communication tests", () => {
  it("Encoding and decoding entry 1", () => {
    const entry = new LogEntry("creator0", "entry", {command: "cmd1", args: ["arg1"]}, [], 1);
    expect(_decodeEntry(_encodeEntry(entry))).toEqual(entry);
  });
  it("Encoding and decoding entry 2", () => {
    const entry = new LogEntry("creator0", "entry", {command: "cmd1", args: []}, ["dep1", "dep2"], 1);
    expect(_decodeEntry(_encodeEntry(entry))).toEqual(entry);
  });
  it("Encoding and decoding entries with project context 1", () => {
    const c = new Communication(9999, "cool_ip", "project1", "Project 1");
    const entry = new LogEntry("creator0", "entry", {command: "cmd1", args: ["arg1"]}, [], 1);
    expect(JSON.stringify(decodeMessage(c.encodeMessage(entry)))).toEqual(JSON.stringify({projectID: "project1", projectName: "Project 1", entry}));
  });
  it("Encoding and decoding entries with project context 2", () => {
    const c = new Communication(9999, "cool_ip", "project1", "Project 1");
    const entry = new LogEntry("creator0", "entry", {command: "cmd1", args: ["arg1"]}, ["dep1", "dep2"], 1);
    expect(JSON.stringify(decodeMessage(c.encodeMessage(entry)))).toEqual(JSON.stringify({projectID: "project1", projectName: "Project 1", entry}));
  });
});