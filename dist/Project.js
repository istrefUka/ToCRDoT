"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = exports.Project = exports.GrowOnlySet = exports.CausalSet = void 0;
exports.loadProject = loadProject;
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("node:fs"));
const uuid_1 = require("uuid");
class CausalSet {
    constructor() {
        this.s = new Map();
    }
    add(x) {
        var _a;
        const val = (_a = this.s.get(x)) !== null && _a !== void 0 ? _a : 0;
        if (val % 2 === 1) {
            console.log(`add: value ${x} already in set`);
            return val;
        }
        this.s.set(x, val + 1);
        return val + 1;
    }
    addAOL(x, value) {
        var _a;
        const val = (_a = this.s.get(x)) !== null && _a !== void 0 ? _a : 0;
        if (val % 2 === 1) {
            console.log(`add: value ${x} already in set`);
            return;
        }
        if (val >= value) {
            return;
        }
        this.s.set(x, value);
        return;
    }
    remove(x) {
        var _a;
        const val = (_a = this.s.get(x)) !== null && _a !== void 0 ? _a : 0;
        if (val % 2 === 0) {
            console.log(`remove: value ${x} already removed`);
            return val;
        }
        this.s.set(x, val + 1);
        return val + 1;
    }
    removeAOL(x, value) {
        var _a;
        const val = (_a = this.s.get(x)) !== null && _a !== void 0 ? _a : 0;
        if (val % 2 === 0) {
            console.log(`remove: value ${x} already removed`);
            return;
        }
        if (val >= value) {
            return;
        }
        console.log("remove AOL" + value);
        this.s.set(x, value);
        return;
    }
    get_set() {
        const output = new Set();
        for (const [key, value] of this.s) {
            if (value % 2 === 1) {
                output.add(key);
            }
        }
        return output;
    }
    debug() {
        console.log(this.s);
    }
    print() {
        console.log(this.get_set());
    }
    /**
     * Merges in any higher “timestamps” from another causal set.
     */
    merge(other) {
        var _a;
        // First, update existing keys if other has a bigger counter
        for (const [key, value] of this.s) {
            const otherval = (_a = other.s.get(key)) !== null && _a !== void 0 ? _a : 0;
            if (otherval > value) {
                this.s.set(key, otherval);
            }
        }
        // Then add any keys that we didn’t have at all
        for (const [key, value] of other.s) {
            if (!this.s.has(key)) {
                this.s.set(key, value);
            }
        }
    }
    toString() {
        const parts = ["CausalSet: {"];
        let first = true;
        for (const [key, value] of this.s) {
            if (!first)
                parts.push(", ");
            first = false;
            parts.push(String(key));
            if (value % 2 === 0) {
                parts.push(": REMOVED");
            }
        }
        parts.push("}");
        return parts.join("");
    }
}
exports.CausalSet = CausalSet;
class GrowOnlySet {
    constructor() {
        this.s = new Map();
    }
    add(x) {
        var _a;
        const val = (_a = this.s.get(x)) !== null && _a !== void 0 ? _a : 0;
        if (val % 2 === 1) {
            console.log(`add: value ${x} already in set`);
            return;
        }
        this.s.set(x, val + 1);
    }
    get_set() {
        const output = new Set();
        for (const [key, value] of this.s) {
            if (value % 2 === 1) {
                output.add(key);
            }
        }
        return output;
    }
    debug() {
        console.log(this.s);
    }
    print() {
        console.log(this.get_set());
    }
    /**
     * Merges in any higher “timestamps” from another causal set.
     */
    merge(other) {
        var _a;
        // First, update existing keys if other has a bigger counter
        for (const [key, value] of this.s) {
            const otherval = (_a = other.s.get(key)) !== null && _a !== void 0 ? _a : 0;
            if (otherval > value) {
                this.s.set(key, otherval);
            }
        }
        // Then add any keys that we didn’t have at all
        for (const [key, value] of other.s) {
            if (!this.s.has(key)) {
                this.s.set(key, value);
            }
        }
    }
    toString() {
        const parts = ["CausalSet: {"];
        let first = true;
        for (const [key, value] of this.s) {
            if (!first)
                parts.push(", ");
            first = false;
            parts.push(String(key));
            if (value % 2 === 0) {
                parts.push(": REMOVED");
            }
        }
        parts.push("}");
        return parts.join("");
    }
}
exports.GrowOnlySet = GrowOnlySet;
//TODO: Notification for all Methods to GUI to let the GUI redraw it.
//TODO: 2 Methoden pro Operation, da wo es Sinn macht.
//TODO: ADD and REMOVE ASSIGNEE methods
//TODO: update Methode
//TODO: boolean statt AOL übergeben
class Project {
    /**
     * AOL muss geladen sein bevor er dieser Methode übergeben wird. Init bei neu kreiertem Projekt, sonst charge.
     * @param projectUUID
     * @param title
     * @param append_only_log
     */
    constructor(projectUUID, title, append_only_log, projects_path) {
        //The method init needs to be called manually if we enter this method
        this.append_only_log = append_only_log;
        this.projectUUID = projectUUID;
        this.title = title;
        this.members = new GrowOnlySet();
        this.tasks = new GrowOnlySet();
        const dir = path_1.default.dirname(projects_path) + projectUUID + '/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(dir + 'project-title.txt', this.title);
    }
    init(creator, displayNameCreator, writeToAOL) {
        this.creator = creator;
        if (writeToAOL) {
            let operation = {
                command: "init",
                args: [creator, displayNameCreator]
            };
            let dependencies = [];
            this.append_only_log.add_operation(creator, operation, dependencies, this.projectUUID);
            this.addMember(creator, displayNameCreator, creator, true);
        }
    }
    save() {
        this.append_only_log.save();
    }
    charge() {
        const ops = this.append_only_log.query_missing_operations_ordered(new Map());
        console.log(ops);
        this.update(ops);
    }
    update(ops) {
        for (let i = 0; i < ops.length; i++) {
            let op = ops[i];
            switch (op.command) {
                case "init":
                    this.init(op.args[0], op.args[1], false);
                    break;
                case "changeName":
                    this.changeName(op.args[0], op.args[1], false);
                    break;
                case "addMember":
                    this.addMember(op.args[0], op.args[1], op.args[2], false);
                    break;
                case "createTask":
                    this.createTask(op.args[0], op.args[1], op.args[2], op.args[3], false);
                    // Noch SetTaskState methode fehlt.
                    break;
                case "setTaskStateAOL":
                    this.setTaskStateAOL(op.args[0], Number(op.args[1]));
                    break;
                case "addTaskAssigneeAOL":
                    this.addTaskAssigneeAOL(op.args[0], op.args[1], Number(op.args[2]));
                    break;
                case "removeTaskAssigneeAOL":
                    this.removeTaskAssigneeAOL(op.args[0], op.args[1], Number(op.args[2]));
                    break;
                default:
                    throw (new Error("LogEntry with wrong command: " + op.command));
            }
        }
    }
    changeName(personUuid, newName, writeToAOL) {
        const currentMembers = this.members.get_set();
        const oldPerson = [...currentMembers].find(p => p.uuid === personUuid);
        if (!oldPerson) {
            throw new Error(`Person ${personUuid} nicht in Projekt ${this.title}`);
        }
        oldPerson.displayName = newName;
        if (!writeToAOL) {
            return;
        }
        let operation = {
            command: "changeName",
            args: [personUuid, newName]
        };
        let entryID = (0, uuid_1.v4)();
        let dependencies = [personUuid]; //Welches nehmen? oder beide?
        this.append_only_log.add_operation(personUuid, operation, dependencies, entryID); //Welche entryID? Ist es Oke newName auch mitzugeben, seitdem auch
    }
    createTask(taskUUID, personUUID, title, description, writeToAOL) {
        let taskState = 0;
        let task = new Task(taskUUID, taskState, title, description, personUUID);
        this.tasks.add(task);
        if (!writeToAOL) {
            return task;
        }
        let operation = {
            command: "createTask",
            args: [taskUUID, personUUID, title, description],
        };
        let dependencies = [this.projectUUID];
        this.append_only_log.add_operation(personUUID, operation, dependencies, taskUUID);
        return task;
    }
    addMember(creatorId, displayName, personUUID, writeToAOL) {
        let newMember = { displayName: displayName, uuid: personUUID };
        this.members.add(newMember);
        if (!writeToAOL) {
            return;
        }
        let operation = { command: "addMember", args: [creatorId, displayName, personUUID] }; //TODO: Lösung finden, um Person zu übergeben.
        let dependencies = [this.projectUUID];
        this.append_only_log.add_operation(creatorId, operation, dependencies, personUUID);
    }
    setTaskStateAOL(taskUUID, newTaskState) {
        let tasks = this.tasks.get_set();
        let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
        if (!task)
            throw new Error(`Task ${taskUUID} nicht gefunden`);
        task.changeState(newTaskState);
    }
    setTaskStateGUI(personUUID, taskUUID, newTaskState) {
        let tasks = this.tasks.get_set();
        let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
        if (!task)
            throw new Error(`Task ${taskUUID} nicht gefunden`);
        task.changeStateGUI(newTaskState);
        let operation = {
            command: "setTaskStateAOL",
            args: [taskUUID, task.get_State_Counter().toString()] //Anpassen!!!
        };
        let dependencies = [taskUUID];
        let entryID = (0, uuid_1.v4)();
        this.append_only_log.add_operation(personUUID, operation, dependencies, entryID); //TODO: Gute EntryID finden, Nur Task als dependency oder gerade alles?
    }
    addTaskAssigneeGUI(creatorID, taskUUID, personUUID) {
        let tasks = this.tasks.get_set();
        let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
        if (!task)
            throw new Error(`Task ${taskUUID} nicht gefunden`);
        let val = task.assignees.add(personUUID);
        console.log(val);
        let operation = {
            command: "addTaskAssigneeAOL",
            args: [taskUUID, personUUID, val.toString()] //Anpassen!!!
        };
        let dependencies = [taskUUID];
        let entryID = (0, uuid_1.v4)();
        this.append_only_log.add_operation(creatorID, operation, dependencies, entryID);
    }
    addTaskAssigneeAOL(taskUUID, personUUID, value) {
        let tasks = this.tasks.get_set();
        let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
        if (!task)
            throw new Error(`Task ${taskUUID} nicht gefunden`);
        task.assignees.addAOL(personUUID, value);
    }
    removeTaskAssigneeGUI(creatorID, taskUUID, personUUID) {
        let tasks = this.tasks.get_set();
        let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
        if (!task)
            throw new Error(`Task ${taskUUID} nicht gefunden`);
        let val = task.assignees.remove(personUUID);
        console.log(val);
        let operation = {
            command: "removeTaskAssigneeAOL",
            args: [taskUUID, personUUID, val.toString()]
        };
        let dependencies = [taskUUID];
        let entryID = (0, uuid_1.v4)();
        this.append_only_log.add_operation(creatorID, operation, dependencies, entryID);
    }
    removeTaskAssigneeAOL(taskUUID, personUUID, value) {
        let tasks = this.tasks.get_set();
        let task = Array.from(tasks).find(t => t.taskUUID === taskUUID);
        if (!task)
            throw new Error(`Task ${taskUUID} nicht gefunden`);
        task.assignees.removeAOL(personUUID, value);
    }
}
exports.Project = Project;
function loadProject(projectUUID, append_only_log, projects_path) {
    const file = projects_path + projectUUID + '/project-title.txt';
    if (!fs.existsSync(file)) {
        throw new Error('could not load project: file doesnt exist');
    }
    const title = fs.readFileSync(file).toString('utf-8');
    return new Project(projectUUID, title, append_only_log, projects_path);
}
// state: 0 = not started, 1 = in Progress, 2 = done
class Task {
    constructor(taskUUID, state, title, description, creator) {
        this.stateCounter = 0;
        this.taskUUID = taskUUID;
        this.state = state;
        this.title = title;
        this.assignees = new CausalSet();
        this.description = description;
        this.creator = creator;
    }
    changeState(newState) {
        if (this.stateCounter >= newState) {
            return;
        }
        this.stateCounter = newState;
        this.state = this.stateCounter % 3; //Die 3 steht für die Anzahl states.
    }
    changeStateGUI(newState) {
        let newerState = 0;
        switch (newState) {
            case "To Do":
                newerState = 0;
                break;
            case "in Progress":
                newerState = 1;
                break;
            case "done":
                newerState = 2;
                break;
            default:
                break;
        }
        this.stateCounter = newerState - this.state + this.stateCounter + 3;
        this.state = newerState;
    }
    get_State_Counter() {
        return this.stateCounter;
    }
    get_state() {
        return this.state;
    }
}
exports.Task = Task;
