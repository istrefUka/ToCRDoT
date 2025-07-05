//import {v4 as uuidv4} from 'uuid';
import * as fs from "fs";

// the following functions shall be used to serialize / deserialize the append-only log
// source: https://stackoverflow.com/a/56150320/13166601
function replacer(key: any, value: any) {
  if(value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}
function reviver(key: any, value: any) {
  if(typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}
// ============

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
  public entryMap = new Map<uuid, LogEntry[]>();
  add_operation(creator: uuid, operation: Operation, dependencies: uuid[], entryID: uuid) {
    if (this._search_entries(entryID) != null) {
      throw new Error("Entry with same UUID already in AppendOnlyLog: " + entryID);
    }
    if (!this._has_dependencies(dependencies)) {
      throw new Error("Couldn't find all of the following dependencies in AOL; dependencies: " + dependencies + " AOL: " + JSON.stringify(this, replacer, 2));
    }
    if (!this.entryMap.has(creator)) {
      this.entryMap.set(creator, new Array<LogEntry>());
    }
    let curr = this.entryMap.get(creator);
    let curr_len = curr!.length;
    let new_entry = new LogEntry(creator, entryID, operation, dependencies, curr_len);
    curr!.push(new_entry);
  }

  update(entries: Array<LogEntry>) {
    for (let entry of entries) {
      if (!this._has_dependencies(entry.dependencies)) {
        throw new Error("Couldn't find all of the following dependencies in AOL; dependencies: " + entry.dependencies + " AOL: " + JSON.stringify(this, replacer, 2));
      }
      if (!this.entryMap.has(entry.creator)) {
        this.entryMap.set(entry.creator, new Array<LogEntry>());
      }
      let curr = this.entryMap.get(entry.creator);
      let curr_len = curr!.length;
      if (curr_len !== entry.index) {
        throw new Error("Tried to add entry that doesn't match the index");
      }

      curr!.push(entry);
    }
  }

  get_frontier(): Frontier {
    let res = new Map<uuid, number>();
    for (let creator of this.entryMap.keys()) {
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
  _query_missing_ids(frontier: Frontier): Array<uuid> {
    let all_nodes_in_subgraph = this._get_missing_ids_unsorted(frontier)
    let subgraph = new Set<uuid>(all_nodes_in_subgraph)
    let unmarked = new Set<uuid>(all_nodes_in_subgraph);
    let temp_marked = new Set<uuid>();
    let resIDs = new Array<uuid>();
    // this function marks the nodes (log-entries) in a depth first manner
    let visit = (nodeID: uuid) => {
      // base case
      if (!unmarked.has(nodeID)) return;

      let current_node = this._search_entries(nodeID); 

      if (temp_marked.has(nodeID)) throw new Error("This graph has a cycle!!");
      if (current_node == null) throw new Error("node " + nodeID + " is not in graph");

      let dependencies = new Set(current_node.dependencies);
      if (current_node.index > 0) {
        // the implicitly defined dependency to the previous entry log of the same person is added
        dependencies.add(this.entryMap.get(current_node.creator)!.at(current_node.index - 1)!.id);
      }
      dependencies = dependencies.intersection(subgraph)
      temp_marked.add(nodeID);

      for (let curr of [...dependencies]) {
        visit(curr);
      }

      temp_marked.delete(nodeID);
      if (!unmarked.delete(nodeID)) {
        throw new Error("could not mark node with nodeID " + nodeID);
      }
      resIDs.unshift(nodeID);
    };

    while (unmarked.size !== 0) {
      let nextNode = unmarked.values().next().value!;
      visit(nextNode);
    }

    return resIDs.reverse();
  }

  query_missing(frontier: Frontier): Array<LogEntry> {
    let resIDs = this._query_missing_ids(frontier);
    let res = new Array<LogEntry>();
    for (let id of resIDs) {
      let curr = this._search_entries(id);
      console.assert(curr != null);
      res.push(curr!);
    }
    return res;
  }

  // TODO implement query_missing_ops

  /**
   * This function saves the append-only log persistently in the file given. 
   * If the file doesn't exist, it is created. 
   * @param file path of file to store the append-only log in. 
   * @throws an error if the directory the file is located in doesn't exist. 
   */
  save_to(file: fs.PathLike): void {
    fs.writeFileSync(file, JSON.stringify(this.entryMap, replacer, 2), "utf-8");
    console.log("wrote append-only log to file " + fs.realpathSync(file).toString());
  }

  /**
   * This function loads the append-only log from the given file. 
   * @param file path of file to load the append-only log from. 
   * @throws an error if the file doesn't exist. 
   */
  load_from(file: fs.PathLike): void {
    this.entryMap = JSON.parse(fs.readFileSync(file, "utf-8").toString(), reviver);
    console.log("append-only log saved successfully");
  }

  _search_entries(id: uuid, creator?: uuid): LogEntry | null {
    if (creator == null) {
      for (let creator of this.entryMap.keys()) {
        for (let entry of this.entryMap.get(creator)!) {
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
    for (let entry of this.entryMap.get(creator)!) {
      if (entry.id === id) {
        return entry;
      }
    }
    return null;
  }

  _get_missing_ids_unsorted(frontier?: Frontier): Array<uuid> {
    if (frontier == null) {
      frontier = new Map<uuid, number>();
    }
    let res = new Array<uuid>();
    for (let creator of this.entryMap.keys()) {
      let min_val = frontier.get(creator) ?? 0;
      for (let entry of this.entryMap.get(creator)!.slice(min_val)) {
        res.push(entry.id);
      }
    }
    return res;
  }

  _has_dependencies(dependencies: uuid[]) {
    return dependencies.every((val) => this._search_entries(val) != null, this);
  }

}
