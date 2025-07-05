import { randomUUID } from "crypto";
import { AppendOnlyLog, LogEntry} from "../main/append_only_log";
import * as fs from "fs"

describe("AppendOnlyLog Tests", () => {
  it("AppendOnlyLog test _search_entries single user", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let entry1 = randomUUID();
    let entry2 = randomUUID();
    let op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, [], entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    let expected_search_res: LogEntry = {creator: creator1, id: entry1, operation: op1, dependencies: [], index: 0}
    expect(log._search_entries(entry1)).toEqual(expected_search_res);
  });
  it("AppendOnlyLog test _search_entries multiple users", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let entry1 = randomUUID();
    let entry2 = randomUUID();
    let entry3 = randomUUID();
    let entry4 = randomUUID();
    let op = {command: "cmd2", args: ["arg3", "arg4", "arg5"]};
    log.add_operation(creator1, {command: "cmd1", args: []}, [], entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    log.add_operation(creator2, {command: "cmd3", args: ["arg5"]}, [entry2, entry1], entry3);
    log.add_operation(creator2, op, [entry1], entry4);
    let expected_search_res: LogEntry = {creator: creator2, id: entry4, operation: op, dependencies: [entry1], index: 1};
    expect(log._search_entries(entry4)).toEqual(expected_search_res);
  });
  it("AppendOnlyLog test _search_entries multiple users but one as arg", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let entry1 = randomUUID();
    let entry2 = randomUUID();
    let entry3 = randomUUID();
    let entry4 = randomUUID();
    let op = {command: "cmd2", args: ["arg3", "arg4", "arg5"]};
    log.add_operation(creator1, {command: "cmd1", args: []}, [], entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    log.add_operation(creator2, {command: "cmd3", args: ["arg5"]}, [entry2, entry1], entry3);
    log.add_operation(creator2, op, [entry1], entry4);
    let expected_search_res: LogEntry = {creator: creator2, id: entry4, operation: op, dependencies: [entry1], index: 1};
    expect(log._search_entries(entry4, creator2)).toEqual(expected_search_res);
    expect(log._search_entries(entry4, creator1)).toBeNull();
  });
  it("AppendOnlyLog throw when same id added", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let entry1 = randomUUID();
    let op = {command: "cmd2", args: ["arg3", "arg4", "arg5"]};
    log.add_operation(creator1, {command: "cmd1", args: []}, [], entry1);
    expect(() => {
      log.add_operation(creator1, {command: "cmd1", args: []}, [], entry1);
    }).toThrow();
  });
  it("AppendOnlyLog throw when adding with missing dependencies 1", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let entry1 = randomUUID();
    let entry2 = randomUUID();
    let op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, [], entry1);
    expect(() => {
      log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry2, entry1], entry2);
    }).toThrow();
  });
  it("AppendOnlyLog throw when adding with missing dependencies 2", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let entry1 = randomUUID();
    let entry2 = randomUUID();
    let entry3 = randomUUID();
    let entry_not_in_aol = randomUUID();
    let op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, [], entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    expect(() => {
      log.add_operation(creator1, {command: "cmd3", args: ["arg6"]}, [entry_not_in_aol, entry2], entry3)
    }).toThrow();
  });
  it("AppendOnlyLog test update", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let entry1 = randomUUID();
    let entry2 = randomUUID();
    let entry3 = randomUUID();
    let entry4 = randomUUID();
    let op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, [], entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    let entry3obj = new LogEntry(creator1, entry3, {command: "cmd3", args: ["arg6", "arg7"]}, [entry2], 2);
    let entry4obj = new LogEntry(creator2, entry4, {command: "cmd4", args: ["arg8"]}, [entry3], 0);
    expect(() => {
      log.update(new Array( entry3obj, entry4obj));
     }).not.toThrow();
    expect(log._search_entries(entry3)).toEqual(entry3obj);
    expect(log._search_entries(entry4)).toEqual(entry4obj);
  });
  it("AppendOnlyLog test update expect fail because missing entries", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let entry1 = randomUUID();
    let entry2 = randomUUID();
    let entry3 = randomUUID();
    let entry4 = randomUUID();
    let op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, [], entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    let entry3obj = new LogEntry(creator1, entry3, {command: "cmd3", args: ["arg6", "arg7"]}, [entry2], 2);
    let entry4obj = new LogEntry(creator2, entry4, {command: "cmd4", args: ["arg8"]}, [entry3], 1);
    expect(() => {
      log.update(new Array( entry3obj, entry4obj));
     }).toThrow();
    expect(log._search_entries(entry3)).toEqual(entry3obj);
    expect(log._search_entries(entry4)).toBeNull();
  });
  it("AppendOnlyLog test get_frontier", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let creator3 = randomUUID();
    let entry1 = randomUUID();
    let entry2 = randomUUID();
    let entry3 = randomUUID();
    let entry4 = randomUUID();
    let entry5 = randomUUID();
    let op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, [], entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    let entry3obj = new LogEntry(creator1, entry3, {command: "cmd3", args: ["arg6", "arg7"]}, [entry2], 2);
    let entry4obj = new LogEntry(creator2, entry4, {command: "cmd4", args: ["arg8"]}, [entry3], 0);
    log.update(new Array( entry3obj, entry4obj));
    log.add_operation(creator3, {command: "cmd5", args: ["arg9"]}, [], entry5);
    expect(log.get_frontier()).toEqual(new Map([
      [creator1, 3],
      [creator2, 1],
      [creator3, 1],
    ]));
  });
  it("AppendOnlyLog test _query_missing_ids 1", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let creator3 = randomUUID();
    let entry0 = "entry0";
    let entry1 = "entry1";
    let entry2 = "entry2";
    let entry3 = "entry3";
    let entry4 = "entry4";
    let entry5 = "entry5";
    let op = {command: "", args: []};
    log.add_operation(creator1, op, [], entry0);
    log.add_operation(creator1, op, [entry0], entry1);
    log.add_operation(creator1, op, [entry1], entry2);
    log.add_operation(creator2, op, [entry0, entry2], entry3);
    log.add_operation(creator3, op, [], entry4);
    log.add_operation(creator1, op, [entry0, entry1, entry3, entry4], entry5);
    let query_res = log._query_missing_entryIDs_ordered(new Map());
    let idx = [entry0, entry1, entry2, entry3, entry4, entry5].map((value) => {return query_res.indexOf(value)});
    expect(query_res.length).toEqual(6);
    expect(idx[2]).toBeGreaterThan(idx[1]);
    expect(idx[3]).toBeGreaterThan(idx[2]);
    expect(idx[3]).toBeGreaterThan(idx[0]);
    expect(idx[5]).toBeGreaterThan(idx[4]);
    expect(idx[5]).toBeGreaterThan(idx[3]);
  });
  it("AppendOnlyLog test _query_missing_ids 2", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let creator3 = randomUUID();
    let entry0 = "entry0";
    let entry1 = "entry1";
    let entry2 = "entry2";
    let entry3 = "entry3";
    let entry4 = "entry4";
    let entry5 = "entry5";
    let op = {command: "", args: []};
    log.add_operation(creator1, op, [], entry0);
    log.add_operation(creator2, op, [entry0], entry1);
    log.add_operation(creator3, op, [entry0], entry2);
    log.add_operation(creator1, op, [entry2, entry1], entry3);
    log.add_operation(creator1, op, [], entry4);
    log.add_operation(creator3, op, [entry4], entry5);
    let query_res = log._query_missing_entryIDs_ordered(new Map());
    let idx = [entry0, entry1, entry2, entry3, entry4, entry5].map((value) => {return query_res.indexOf(value)});
    expect(query_res.length).toEqual(6);
    expect(idx.every((val) => val >= 0)).toBeTruthy();
    expect(idx[5]).toBeGreaterThan(idx[4]);
    expect(idx[3]).toBeGreaterThan(idx[2]);
    expect(idx[4]).toBeGreaterThan(idx[3]); // from implicit ordering within a list from a creator
    expect(idx[1]).toBeGreaterThan(idx[0]);
    expect(idx[2]).toBeGreaterThan(idx[0]);
  });
  it("AppendOnlyLog test _query_missing_ids 3", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let creator3 = randomUUID();
    let entry0 = "entry0";
    let entry1 = "entry1";
    let entry2 = "entry2";
    let entry3 = "entry3";
    let entry4 = "entry4";
    let entry5 = "entry5";
    let op = {command: "", args: []};
    log.add_operation(creator1, op, [], entry0);
    log.add_operation(creator2, op, [entry0], entry1);
    log.add_operation(creator3, op, [entry0], entry2);
    log.add_operation(creator1, op, [entry2, entry1], entry3);
    log.add_operation(creator1, op, [], entry4);
    log.add_operation(creator3, op, [entry4], entry5);
    let query_res = log._query_missing_entryIDs_ordered(new Map([
      [creator1, 2],
      [creator2, 1],
    ]));
    expect(query_res.length).toEqual(3);
  });
  it("AppendOnlyLog test _query_missing_ids 4", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let creator3 = randomUUID();
    let entry0 = "entry0";
    let entry1 = "entry1";
    let entry2 = "entry2";
    let entry3 = "entry3";
    let entry4 = "entry4";
    let entry5 = "entry5";
    let op = {command: "", args: []};
    log.add_operation(creator1, op, [], entry0);
    log.add_operation(creator2, op, [entry0], entry1);
    log.add_operation(creator3, op, [entry0], entry2);
    log.add_operation(creator1, op, [entry2, entry1], entry3);
    log.add_operation(creator1, op, [], entry4);
    log.add_operation(creator3, op, [entry4], entry5);
    let query_res = log._query_missing_entryIDs_ordered(new Map([
      [creator1, 10],
      [creator2, 1],
    ]));
    expect(query_res.length).toEqual(2);
  });
  it("AppendOnlyLog test _query_missing_ids 4", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let creator3 = randomUUID();
    let entry0 = "entry0";
    let entry1 = "entry1";
    let entry2 = "entry2";
    let entry3 = "entry3";
    let entry4 = "entry4";
    let entry5 = "entry5";
    let op = {command: "", args: []};
    log.add_operation(creator1, op, [], entry0);
    log.add_operation(creator2, op, [entry0], entry1);
    log.add_operation(creator3, op, [entry0], entry2);
    log.add_operation(creator1, op, [entry2, entry1], entry3);
    log.add_operation(creator1, op, [], entry4);
    log.add_operation(creator3, op, [entry4], entry5);
    let query_res = log._query_missing_entryIDs_ordered(new Map([
      [creator1, 10],
      [creator2, 1],
    ]));
    expect(query_res.length).toEqual(2);
  });
  it("AppendOnlyLog test saving and loading", () => {
    let log = new AppendOnlyLog();
    let creator1 = randomUUID();
    let creator2 = randomUUID();
    let creator3 = randomUUID();
    let entry1 = randomUUID();
    let entry2 = randomUUID();
    let entry3 = randomUUID();
    let entry4 = randomUUID();
    let entry5 = randomUUID();
    let op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, [], entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    log.add_operation(creator1, {command: "cmd3", args: ["arg6", "arg7"]}, [entry2], entry3);
    log.add_operation(creator2, {command: "cmd4", args: ["arg8"]}, [entry3], entry4);
    log.add_operation(creator3, {command: "cmd5", args: ["arg9"]}, [], entry5);
    fs.mkdirSync("test_tmp/", { recursive: true });
    log.save_to("test_tmp/test.json");
    let log2 = new AppendOnlyLog();
    log2.load_from("test_tmp/test.json");
    expect(log2).toEqual(log);
    fs.rmdirSync("test_tmp/", { recursive: true });
  })
  it("AppendOnlyLog test saving to a nonexistent directory", () => {
    let log = new AppendOnlyLog();
    expect(() => {log.save_to("this_path_doesnt_exist/test.json")}).toThrow();
  })
  // TODO test query_missing, query_missing_ops
  // TODO test save_to, load_from
})