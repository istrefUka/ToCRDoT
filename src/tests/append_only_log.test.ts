import { randomUUID } from "crypto";
import { AppendOnlyLog, LogEntry, uuid} from "../main/append_only_log";
import * as fs from "fs"

describe("AppendOnlyLog Tests", () => {
  const empty = new Array<uuid>();
  it("AppendOnlyLog test _search_entries single user", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, empty, entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    const expected_search_res: LogEntry = {creator: creator1, id: entry1, operation: op1, dependencies: empty, index: 0}
    expect(log._search_entries(entry1)).toEqual(expected_search_res);
  });
  it("AppendOnlyLog test _search_entries multiple users", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const entry3 = randomUUID();
    const entry4 = randomUUID();
    const op = {command: "cmd2", args: ["arg3", "arg4", "arg5"]};
    log.add_operation(creator1, {command: "cmd1", args: empty}, empty, entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    log.add_operation(creator2, {command: "cmd3", args: ["arg5"]}, [entry2, entry1], entry3);
    log.add_operation(creator2, op, [entry1], entry4);
    const expected_search_res: LogEntry = {creator: creator2, id: entry4, operation: op, dependencies: [entry1], index: 1};
    expect(log._search_entries(entry4)).toEqual(expected_search_res);
  });
  it("AppendOnlyLog test _search_entries multiple users but one as arg", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const entry3 = randomUUID();
    const entry4 = randomUUID();
    const op = {command: "cmd2", args: ["arg3", "arg4", "arg5"]};
    log.add_operation(creator1, {command: "cmd1", args: empty}, empty, entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    log.add_operation(creator2, {command: "cmd3", args: ["arg5"]}, [entry2, entry1], entry3);
    log.add_operation(creator2, op, [entry1], entry4);
    const expected_search_res: LogEntry = {creator: creator2, id: entry4, operation: op, dependencies: [entry1], index: 1};
    expect(log._search_entries(entry4, creator2)).toEqual(expected_search_res);
    expect(log._search_entries(entry4, creator1)).toBeNull();
  });
  it("AppendOnlyLog throw when same id added", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const entry1 = randomUUID();
    log.add_operation(creator1, {command: "cmd1", args: empty}, empty, entry1);
    expect(() => {
      log.add_operation(creator1, {command: "cmd1", args: empty}, empty, entry1);
    }).toThrow();
  });
  it("AppendOnlyLog throw when adding with missing dependencies 1", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, empty, entry1);
    expect(() => {
      log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry2, entry1], entry2);
    }).toThrow();
  });
  it("AppendOnlyLog throw when adding with missing dependencies 2", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const entry3 = randomUUID();
    const entry_not_in_aol = randomUUID();
    const op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, empty, entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    expect(() => {
      log.add_operation(creator1, {command: "cmd3", args: ["arg6"]}, [entry_not_in_aol, entry2], entry3)
    }).toThrow();
  });
  it("AppendOnlyLog test update", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const entry3 = randomUUID();
    const entry4 = randomUUID();
    const op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, empty, entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    const entry3obj = new LogEntry(creator1, entry3, {command: "cmd3", args: ["arg6", "arg7"]}, [entry2], 2);
    const entry4obj = new LogEntry(creator2, entry4, {command: "cmd4", args: ["arg8"]}, [entry3], 0);
    expect(() => {
      log.update([ entry3obj, entry4obj]);
    }).not.toThrow();
    expect(log._search_entries(entry3)).toEqual(entry3obj);
    expect(log._search_entries(entry4)).toEqual(entry4obj);
  });
  it("AppendOnlyLog test update expect fail because missing entries", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const entry3 = randomUUID();
    const entry4 = randomUUID();
    const op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, empty, entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    const entry3obj = new LogEntry(creator1, entry3, {command: "cmd3", args: ["arg6", "arg7"]}, [entry2], 2);
    const entry4obj = new LogEntry(creator2, entry4, {command: "cmd4", args: ["arg8"]}, [entry3], 1);
    expect(() => {
      log.update([ entry3obj, entry4obj]);
    }).toThrow();
    expect(log._search_entries(entry3)).toEqual(entry3obj);
    expect(log._search_entries(entry4)).toBeNull();
  });
  it("AppendOnlyLog test get_frontier", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const creator3 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const entry3 = randomUUID();
    const entry4 = randomUUID();
    const entry5 = randomUUID();
    const op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, empty, entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    const entry3obj = new LogEntry(creator1, entry3, {command: "cmd3", args: ["arg6", "arg7"]}, [entry2], 2);
    const entry4obj = new LogEntry(creator2, entry4, {command: "cmd4", args: ["arg8"]}, [entry3], 0);
    log.update([ entry3obj, entry4obj]);
    log.add_operation(creator3, {command: "cmd5", args: ["arg9"]}, empty, entry5);
    expect(log.get_frontier()).toEqual(new Map([
      [creator1, 3],
      [creator2, 1],
      [creator3, 1],
    ]));
  });
  it("AppendOnlyLog test _query_missing_ids 1", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const creator3 = randomUUID();
    const entry0 = "entry0";
    const entry1 = "entry1";
    const entry2 = "entry2";
    const entry3 = "entry3";
    const entry4 = "entry4";
    const entry5 = "entry5";
    const op = {command: "", args: empty};
    log.add_operation(creator1, op, empty, entry0);
    log.add_operation(creator1, op, [entry0], entry1);
    log.add_operation(creator1, op, [entry1], entry2);
    log.add_operation(creator2, op, [entry0, entry2], entry3);
    log.add_operation(creator3, op, empty, entry4);
    log.add_operation(creator1, op, [entry0, entry1, entry3, entry4], entry5);
    const query_res = log._query_missing_entryIDs_ordered(new Map());
    const idx = [entry0, entry1, entry2, entry3, entry4, entry5].map((value) => {return query_res.indexOf(value)});
    expect(query_res.length).toEqual(6);
    expect(idx[2]).toBeGreaterThan(idx[1]);
    expect(idx[3]).toBeGreaterThan(idx[2]);
    expect(idx[3]).toBeGreaterThan(idx[0]);
    expect(idx[5]).toBeGreaterThan(idx[4]);
    expect(idx[5]).toBeGreaterThan(idx[3]);
  });
  it("AppendOnlyLog test _query_missing_ids 2", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const creator3 = randomUUID();
    const entry0 = "entry0";
    const entry1 = "entry1";
    const entry2 = "entry2";
    const entry3 = "entry3";
    const entry4 = "entry4";
    const entry5 = "entry5";
    const op = {command: "", args: empty};
    log.add_operation(creator1, op, empty, entry0);
    log.add_operation(creator2, op, [entry0], entry1);
    log.add_operation(creator3, op, [entry0], entry2);
    log.add_operation(creator1, op, [entry2, entry1], entry3);
    log.add_operation(creator1, op, empty, entry4);
    log.add_operation(creator3, op, [entry4], entry5);
    const query_res = log._query_missing_entryIDs_ordered(new Map());
    const idx = [entry0, entry1, entry2, entry3, entry4, entry5].map((value) => {return query_res.indexOf(value)});
    expect(query_res.length).toEqual(6);
    expect(idx.every((val) => val >= 0)).toBeTruthy();
    expect(idx[5]).toBeGreaterThan(idx[4]);
    expect(idx[3]).toBeGreaterThan(idx[2]);
    expect(idx[4]).toBeGreaterThan(idx[3]); // from implicit ordering within a list from a creator
    expect(idx[1]).toBeGreaterThan(idx[0]);
    expect(idx[2]).toBeGreaterThan(idx[0]);
  });
  it("AppendOnlyLog test _query_missing_ids 3", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const creator3 = randomUUID();
    const entry0 = "entry0";
    const entry1 = "entry1";
    const entry2 = "entry2";
    const entry3 = "entry3";
    const entry4 = "entry4";
    const entry5 = "entry5";
    const op = {command: "", args: empty};
    log.add_operation(creator1, op, empty, entry0);
    log.add_operation(creator2, op, [entry0], entry1);
    log.add_operation(creator3, op, [entry0], entry2);
    log.add_operation(creator1, op, [entry2, entry1], entry3);
    log.add_operation(creator1, op, empty, entry4);
    log.add_operation(creator3, op, [entry4], entry5);
    const query_res = log._query_missing_entryIDs_ordered(new Map([
      [creator1, 2],
      [creator2, 1],
    ]));
    log.validate();
    expect(query_res.length).toEqual(3);
  });
  it("AppendOnlyLog test _query_missing_ids 4", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const creator3 = randomUUID();
    const entry0 = "entry0";
    const entry1 = "entry1";
    const entry2 = "entry2";
    const entry3 = "entry3";
    const entry4 = "entry4";
    const entry5 = "entry5";
    const op = {command: "", args: empty};
    log.add_operation(creator1, op, empty, entry0);
    log.add_operation(creator2, op, [entry0], entry1);
    log.add_operation(creator3, op, [entry0], entry2);
    log.add_operation(creator1, op, [entry2, entry1], entry3);
    log.add_operation(creator1, op, empty, entry4);
    log.add_operation(creator3, op, [entry4], entry5);
    const query_res = log._query_missing_entryIDs_ordered(new Map([
      [creator1, 10],
      [creator2, 1],
    ]));
    log.validate();
    expect(query_res.length).toEqual(2);
  });
  it("AppendOnlyLog test _query_missing_ids 4", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const creator3 = randomUUID();
    const entry0 = "entry0";
    const entry1 = "entry1";
    const entry2 = "entry2";
    const entry3 = "entry3";
    const entry4 = "entry4";
    const entry5 = "entry5";
    const op = {command: "", args: empty};
    log.add_operation(creator1, op, empty, entry0);
    log.add_operation(creator2, op, [entry0], entry1);
    log.add_operation(creator3, op, [entry0], entry2);
    log.add_operation(creator1, op, [entry2, entry1], entry3);
    log.add_operation(creator1, op, empty, entry4);
    log.add_operation(creator3, op, [entry4], entry5);
    const query_res = log._query_missing_entryIDs_ordered(new Map([
      [creator1, 10],
      [creator2, 1],
    ]));
    log.validate();
    expect(query_res.length).toEqual(2);
  });
  it("AppendOnlyLog test saving and loading", () => {
    const log = new AppendOnlyLog("test_tmp/test.json");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const creator3 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const entry3 = randomUUID();
    const entry4 = randomUUID();
    const entry5 = randomUUID();
    const op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    log.add_operation(creator1, op1, empty, entry1);
    log.add_operation(creator1, {command: "cmd2", args: ["arg3", "arg4", "arg5"]}, [entry1], entry2);
    log.add_operation(creator1, {command: "cmd3", args: ["arg6", "arg7"]}, [entry2], entry3);
    log.add_operation(creator2, {command: "cmd4", args: ["arg8"]}, [entry3], entry4);
    log.add_operation(creator3, {command: "cmd5", args: ["arg9"]}, empty, entry5);
    log.validate();
    log.save();
    const log2 = new AppendOnlyLog("test_tmp/test.json");
    log2.load();
    log2.validate();
    expect(log2).toEqual(log);
    fs.rmdirSync("test_tmp/", { recursive: true });
  })
  it("AppendOnlyLog test saving to a nonexistent directory", () => {
    const log = new AppendOnlyLog("this_path_doesnt_exist/test.json");
    log.validate();
    expect(() => {log.save()}).not.toThrow();
  })
  it("AppendOnlyLog test update with entries already in log", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const creator3 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const entry3 = randomUUID();
    const entry4 = randomUUID();
    const entry5 = randomUUID();
    const op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    const op2 = {command: "cmd2", args: ["arg3", "arg4", "arg5"]};
    log.add_operation(creator1, op1, empty, entry1);
    log.add_operation(creator1, op2, [entry1], entry2);
    log.add_operation(creator1, {command: "cmd3", args: ["arg6", "arg7"]}, [entry2], entry3);
    log.add_operation(creator2, {command: "cmd4", args: ["arg8"]}, [entry3], entry4);
    log.add_operation(creator3, {command: "cmd5", args: ["arg9"]}, empty, entry5);
    log.update([
      new LogEntry(creator1, entry2, op2, [entry1], 1)
    ]);
    log.validate();
  })
  it("AppendOnlyLog test update with entries already in log, data inconsistency", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const creator2 = randomUUID();
    const creator3 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const entry3 = randomUUID();
    const entry4 = randomUUID();
    const entry5 = randomUUID();
    const op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    const op2 = {command: "cmd2", args: ["arg3", "arg4", "arg5"]};
    const op3 = {command: "cmd3", args: ["arg6", "arg7"]};
    log.add_operation(creator1, op1, empty,entry1);
    log.add_operation(creator1, op2, [entry1], entry2);
    log.add_operation(creator1, op3, [entry2], entry3);
    log.add_operation(creator2, {command: "cmd4", args: ["arg8"]}, [entry3], entry4);
    log.add_operation(creator3, {command: "cmd5", args: ["arg9"]}, empty, entry5);
    log.validate();
    expect(() => {log.update([
      new LogEntry(creator1, entry3, op2, [entry1], 2) // the dependencies don't match
    ])}).toThrow();
  })
  it("AppendOnlyLog test validate", () => {
    const log = new AppendOnlyLog("");
    const creator1 = randomUUID();
    const entry1 = randomUUID();
    const entry2 = randomUUID();
    const entry3 = randomUUID();
    const op1 = {command: "cmd1", args: ["arg1", "arg2"]};
    const op2 = {command: "cmd2", args: ["arg3", "arg4", "arg5"]};
    const op3 = {command: "cmd3", args: ["arg6", "arg7"]};
    log.add_operation(creator1, op1, empty, entry1);
    log.add_operation(creator1, op2, [entry1], entry2);
    log.entryMap.get(creator1)?.push(new LogEntry(creator1, entry2, op3, empty, 2)); // insert entry with duplicate id
    expect(() => {
      log.validate()
    }).toThrow();
    log.entryMap.get(creator1)?.pop();
    expect(() => {
      log.validate()
    }).not.toThrow();
    log.entryMap.get(creator1)?.push(new LogEntry(creator1, entry3, op3, ["garbage"], 2)); // insert entry with garbage dependency
    expect(() => {
      log.validate()
    }).toThrow();
    log.entryMap.get(creator1)?.pop();
    expect(() => {
      log.validate()
    }).not.toThrow();
    log.entryMap.get(creator1)?.push(new LogEntry("garbage", entry3, op3, empty, 2)); // insert entry with wrong creator id
    expect(() => {
      log.validate()
    }).toThrow();
    log.entryMap.get(creator1)?.pop();
    expect(() => {
      log.validate()
    }).not.toThrow();
    log.entryMap.get(creator1)?.push(new LogEntry(creator1, entry3, op3, empty, 1)); // insert entry with wrong index
    expect(() => {
      log.validate()
    }).toThrow();
  })
})