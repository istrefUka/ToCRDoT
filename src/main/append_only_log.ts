//import {v4 as uuidv4} from 'uuid';
import * as fs from "fs";
import { mapReplacer, mapReviver } from "./utils"
import path from "path";

export type uuid = string; //`${string}-${string}-${string}-${string}-${string}`;

export type Person = {
  displayName: string,
  uuid: uuid,
}
export type Operation = {
  command: string,
  args: string[],
}

export class LogEntry {
  creator: uuid;
  id: uuid;
  operation: Operation;
  index: number;
  dependencies: uuid[]; // ids of log-entries

  constructor(creator: uuid, id: uuid, operation: Operation, dependencies: uuid[], index: number){
    this.creator = creator;
    this.id = id;
    this.operation = operation;
    this.index = index;
    this.dependencies = dependencies;
  }
}

export type Frontier = Map<uuid, number>;

export class AppendOnlyLog {
  private path: string;
  public entryMap = new Map<uuid, LogEntry[]>();

  constructor(path: string) {
    this.path = path;
  }

  add_operation(creator: uuid, operation: Operation, dependencies: uuid[], entryID: uuid) {
    if (this._search_entries(entryID) != null) {
      throw new Error("Entry with same UUID already in AppendOnlyLog: " + entryID);
    }
    if (!this._has_dependencies(dependencies)) {
      throw new Error("Couldn't find all of the following dependencies in AOL; dependencies: " + dependencies + " AOL: " + JSON.stringify(this, mapReplacer, 2));
    }
    if (!this.entryMap.has(creator)) {
      this.entryMap.set(creator, new Array<LogEntry>());
    }
    const curr = this.entryMap.get(creator);
    const curr_len = curr!.length;
    const new_entry = new LogEntry(creator, entryID, operation, dependencies, curr_len);
    curr!.push(new_entry);
  }

  update(entries: Array<LogEntry>) {
    for (const entry of entries) {
      if (!this._has_dependencies(entry.dependencies)) {
        throw new Error("Couldn't find all of the following dependencies in AOL; dependencies: " + entry.dependencies + " AOL: " + JSON.stringify(this, mapReplacer, 2));
      }
      if (!this.entryMap.has(entry.creator)) {
        this.entryMap.set(entry.creator, new Array<LogEntry>());
      }
      const curr = this.entryMap.get(entry.creator);
      const curr_len = curr!.length;
      if (curr_len < entry.index) {
        throw new Error("Tried to add entry that skips spot in log of creator " + entry.creator);
      }
      if (curr_len > entry.index) {
        const local_entry = curr![entry.index];
        if (JSON.stringify(local_entry) !== JSON.stringify(entry)) {
          // todo: replace this error with a warning once a logging system is in place
          throw new Error("entries don't match; received entry " + JSON.stringify(entry, undefined, 2) + " but entry " + JSON.stringify(local_entry, undefined, 2) + " was in log")
        }
        return;
      }

      curr!.push(entry);
    }
  }

  validate(): void {
    const entryID_counts = new Map<uuid, number>();
    let duplicates = false;
    for (const creator of this.entryMap.keys()) {
      const curr_array = this.entryMap.get(creator)!;
      for (let i = 0; i < curr_array.length; i++) {
        const curr_entry = curr_array[i];
        if (curr_entry.index !== i) {
          throw new Error("index of entry " + curr_entry.id + " doesn't match");
        }
        if (curr_entry.creator !== creator) {
          throw new Error("creator of entry " + curr_entry.id + " doesn't match");
        }
        if (!this._has_dependencies(curr_entry.dependencies)) {
          throw new Error("dependencies of entry " + curr_entry.id + " aren't present in append-only log");
        }

        if (entryID_counts.has(curr_entry.id)) {
          duplicates = true;
        }
        entryID_counts.set(curr_entry.id, (entryID_counts.get(curr_entry.id) ?? 0) + 1);
      }
    }

    if (duplicates) {
      let s = "";
      let first_iter = true;
      for (const k of entryID_counts.keys()) {
        if (entryID_counts.get(k)! > 1) {
          if (!first_iter) {
            s += ", ";
          }
          s += k;
          first_iter = false;
        }
      }
      throw new Error("The following entries were duplicates: " + s);
    }
  }

  get_frontier(): Frontier {
    const res = new Map<uuid, number>();
    for (const creator of this.entryMap.keys()) {
      res.set(creator, this.entryMap.get(creator)!.length);
    }
    return res;
  }

  /**
   * the resulting array must be topologically sorted.
   * algorithm used: https://en.wikipedia.org/wiki/Topological_sorting#Depth-first_search
   * @param frontier other frontier to diff against our frontier
   * @returns the LogEntries that the other replica is missing based on their frontier. In a topological order. 
   */
  _query_missing_entryIDs_ordered(frontier: Frontier): Array<uuid> {
    const all_nodes_in_subgraph = this._query_missing_entryIDs_unordered(frontier)
    const subgraph = new Set<uuid>(all_nodes_in_subgraph)
    const unmarked = new Set<uuid>(all_nodes_in_subgraph);
    const temp_marked = new Set<uuid>();
    const resIDs = new Array<uuid>();
    // this function marks the nodes (log-entries) in a depth first manner
    const visit = (nodeID: uuid) => {
      // base case
      if (!unmarked.has(nodeID)) return;

      const current_node = this._search_entries(nodeID); 

      if (temp_marked.has(nodeID)) throw new Error("This graph has a cycle!!");
      if (current_node == null) throw new Error("node " + nodeID + " is not in graph");

      const dependencies = new Set(current_node.dependencies);
      if (current_node.index > 0) {
        // the implicitly defined dependency to the previous entry log of the same person is added
        dependencies.add(this.entryMap.get(current_node.creator)![current_node.index - 1].id);
      }
      //dependencies = dependencies.intersection(subgraph)
      dependencies.forEach((s) => {
        if (!subgraph.has(s)) {
          dependencies.delete(s);
        }
      })
      temp_marked.add(nodeID);

      for (const curr of [...dependencies]) {
        visit(curr);
      }

      temp_marked.delete(nodeID);
      if (!unmarked.delete(nodeID)) {
        throw new Error("could not mark node with nodeID " + nodeID);
      }
      resIDs.unshift(nodeID);
    };

    while (unmarked.size !== 0) {
      const nextNode = unmarked.values().next().value!;
      visit(nextNode);
    }

    return resIDs.reverse();
  }

  query_missing_entries_ordered(frontier: Frontier): Array<LogEntry> {
    const resIDs = this._query_missing_entryIDs_ordered(frontier);
    const res = new Array<LogEntry>();
    for (const id of resIDs) {
      const curr = this._search_entries(id);
      console.assert(curr != null);
      res.push(curr!);
    }
    return res;
  }

  query_missing_operations_ordered(old_frontier: Frontier): Array<Operation> {
    const entries = this.query_missing_entries_ordered(old_frontier);
    const res = new Array<Operation>();
    for (const e of entries) {
      res.push(e.operation);
    }
    return res;
  }

  /**
   * This function saves the append-only log persistently in the file given. 
   * If the file doesn't exist, it is created. 
   * @param file path of file to store the append-only log in. 
   * @throws an error if the directory the file is located in doesn't exist. 
   */
  save(): void {
    const dir = path.dirname(this.path);
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.path, JSON.stringify(this.entryMap, mapReplacer, 2), "utf-8");
    console.log("wrote append-only log to file " + fs.realpathSync(this.path).toString());
  }

  /**
   * This function loads the append-only log from the given file. 
   * @param file path of file to load the append-only log from. 
   * @throws an error if the file doesn't exist. 
   */
  load(): void {
    this.entryMap = JSON.parse(fs.readFileSync(this.path, "utf-8").toString(), mapReviver);
    console.log("append-only log saved successfully");
  }

  _search_entries(id: uuid, creator?: uuid): LogEntry | null {
    if (creator == null) {
      for (const creator of this.entryMap.keys()) {
        for (const entry of this.entryMap.get(creator)!) {
          if (id === entry.id){
            return entry;
          }
        }
      }
      return null;
    }
    if (!this.entryMap.has(creator)) {
      Error("creator with id " + creator + " could not be found");
    }
    for (const entry of this.entryMap.get(creator)!) {
      if (entry.id === id) {
        return entry;
      }
    }
    return null;
  }

  _query_missing_entryIDs_unordered(frontier?: Frontier): Array<uuid> {
    if (frontier == null) {
      frontier = new Map<uuid, number>();
    }
    const res = new Array<uuid>();
    for (const creator of this.entryMap.keys()) {
      const min_val = frontier.get(creator) ?? 0;
      for (const entry of this.entryMap.get(creator)!.slice(min_val)) {
        res.push(entry.id);
      }
    }
    return res;
  }

  _has_dependencies(dependencies: uuid[]) {
    return dependencies.every((val) => this._search_entries(val) != null, this);
  }

}
