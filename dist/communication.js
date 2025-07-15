"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectListener = exports.ProjectCommunication = void 0;
exports._encodeEntry = _encodeEntry;
exports.decodeMessage = decodeMessage;
exports._decodeEntry = _decodeEntry;
const dgram_1 = __importDefault(require("dgram"));
const append_only_log_1 = require("./append_only_log");
const os_1 = __importDefault(require("os"));
const utils_1 = require("./utils");
class BaseCommunication {
    constructor(broadcast_ip, port) {
        this.onMessageCallback = undefined;
        this.socket = dgram_1.default.createSocket('udp4');
        this.broadcast_ip = broadcast_ip !== null && broadcast_ip !== void 0 ? broadcast_ip : findBroadcast();
        this._port = port;
    }
    init() {
        this.socket = dgram_1.default.createSocket('udp4');
        this.initSocket();
        return bindSocket(this.socket, this._port);
    }
    close() {
        return closeSocket(this.socket);
    }
    initSocket() {
        // This event prints and error message and closes the socket.
        this.socket.on('error', (err) => {
            console.error('client error:', err.stack);
            this.socket.close();
        });
        // This event logs where the instance is listening on.
        this.socket.on('listening', () => {
            const address = this.socket.address();
            console.log('listening on:', address.address, ':', address.port);
        });
    }
    get port() {
        return this._port;
    }
    send(msg) {
        this.socket.send(msg);
        console.log('sent message:', msg.toString('utf-8'), 'to', this.broadcast_ip, this._port);
    }
    /**
     * This method replaces the callback that is currently used when a message arrives with the new callback.
     * @param onMessageCallback callback to be called when a message arrives
     */
    onMessage(onMessageCallback) {
        if (this.onMessageCallback != null) {
            this.socket.off('message', this.onMessageCallback);
        }
        this.socket.on('message', onMessageCallback);
        this.onMessageCallback = onMessageCallback;
    }
    setBroadcastIP(broadcast_ip) {
        this.broadcast_ip = broadcast_ip;
    }
    setPort(port) {
        return new Promise((resolve) => {
            const r = () => __awaiter(this, void 0, void 0, function* () {
                yield closeSocket(this.socket);
                this.socket = dgram_1.default.createSocket('udp4');
                this.initSocket();
                if (this.onMessageCallback != null) {
                    this.onMessage(this.onMessageCallback);
                }
                yield bindSocket(this.socket, port);
                this._port = port;
                resolve();
            });
            if (this.socket) {
                closeSocket(this.socket).then(r);
            }
            else {
                r();
            }
        });
    }
}
/**
 * This class implements the communication necessary for when a project is open.
 */
class ProjectCommunication {
    /**
     * The init-method should be called after this constructor.
     * @param port
     * @param broadcast_ip
     * @param projectID UUID of project that is currently open
     * @param projectName
     * @param appendOnlyLog append-only log that the crdt-object shall use.
     * @param crdt_update_callback this callback is executed when the append-only log changes. It receives the changes as operations since the last update.
     */
    constructor(port, broadcast_ip, projectID, projectName, appendOnlyLog, crdt_update_callback) {
        this.communication = new BaseCommunication(broadcast_ip, port);
        this.projectID = projectID;
        this.projectName = projectName;
        this.appendOnlyLog = appendOnlyLog;
        this.crdt_update_callback = crdt_update_callback;
        this.delay_ms = 10000;
    }
    get port() {
        return this.communication.port;
    }
    get broadcast_ip() {
        return this.communication.broadcast_ip;
    }
    close() {
        return this.communication.close();
    }
    init() {
        return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
            yield this.communication.init();
            this.communication.onMessage((msg, rinfo) => {
                const decoded_msg = decodeMessage(msg);
                if (decoded_msg.projectID !== this.projectID) {
                    return;
                }
                console.log('received message:', msg);
                console.log('received message (decoded):', decoded_msg, 'from', rinfo.address, rinfo.port);
                const o = this.appendOnlyLog.get_frontier();
                this.handleMessage(decoded_msg);
                this.crdt_update_callback(this.appendOnlyLog.query_missing_operations_ordered(o));
            });
            resolve();
        }));
    }
    handleMessage(msg) {
        if ((0, utils_1.isLogEntry)(msg.data)) {
            this.appendOnlyLog.update([msg.data]);
            this.appendOnlyLog.save();
        }
        else if ((0, utils_1.isFrontier)(msg.data)) {
            const frontier = msg.data;
            for (const entry of this.appendOnlyLog.query_missing_entries_ordered(frontier)) {
                this.sendMessage(entry);
            }
        }
        else {
            throw new Error("Message invalid");
        }
    }
    sendFrontier() {
        this.sendMessage(this.appendOnlyLog.get_frontier());
    }
    encodeMessage(data) {
        const res_arr = new Array();
        res_arr.push(this.projectID);
        res_arr.push((0, utils_1.toBase64)(this.projectName));
        if ((0, utils_1.isLogEntry)(data)) {
            res_arr.push('e');
            res_arr.push(_encodeEntry(data));
        }
        else if ((0, utils_1.isFrontier)(data)) {
            res_arr.push('f');
            res_arr.push(_encodeFrontier(data));
        }
        else {
            throw new Error('Message could not be encoded');
        }
        //console.log("encoded message: " + res_arr.join(' '));
        return res_arr.join(' ');
    }
    setBroadcastIP(broadcast_ip) {
        this.communication.setBroadcastIP(broadcast_ip);
    }
    setPort(port) {
        return this.communication.setPort(port);
    }
    /**
     * This method sends an entry of an append-only log to a specified ip.
     *
     * @param data The entry to be sent
     */
    sendMessage(data) {
        try {
            const enc = Buffer.from(this.encodeMessage(data), 'utf8');
            this.communication.send(enc);
        }
        catch (error) {
            console.log('Error:', error, '\nSending entry:', data);
        }
    }
    /**
     * This method sends the frontier repeatedly with the delay specified in this.delay_ms.
     */
    messageLoop() {
        return __awaiter(this, void 0, void 0, function* () {
            let msgIndex = 0;
            while (true) {
                this.sendMessage(this.appendOnlyLog.get_frontier());
                msgIndex++;
                yield sleep(this.delay_ms);
            }
        });
    }
}
exports.ProjectCommunication = ProjectCommunication;
/**
 * This class is used to listen for other projects on a given interface.
 * Use the init-method to specify in a callback what happens when a message is received and start listening.
 */
class ProjectListener {
    /**
     * Set initial interface of communication.
     * @param broadcast_ip broadcast-ip to use for receiving. If undefined, it tries to find a broadcast-ip on it's own.
     * @param port
     */
    constructor(broadcast_ip, port) {
        this.communication = new BaseCommunication(broadcast_ip, port);
    }
    /**
     * Initialize the listening with a callback.
     * @param onMessageCallback This is the callback for when a message arrives. NOTE: should be used for creating a popup
     */
    init(onMessageCallback) {
        this.communication.init();
        this.communication.onMessage(onMessageCallback);
    }
    get port() {
        return this.communication.port;
    }
    get broadcast_ip() {
        return this.communication.broadcast_ip;
    }
    setPort(port) {
        return this.communication.setPort(port);
    }
    setBroadcastIP(broadcast_ip) {
        this.communication.setBroadcastIP(broadcast_ip);
    }
    close() {
        this.communication.close();
    }
}
exports.ProjectListener = ProjectListener;
/**
 * This function encodes a command into a string. This works by first converting
 * the strings that possibly contain spaces into base64 and concatenate them with
 * spaces in between.
 *
 * @param entry The command to be encoded
 * @returns The string encoding of the command
 */
function _encodeEntry(entry) {
    // Encode the relevant fields
    // no base64 necessary as ids are assumed to have no spaces
    const res_arr = new Array();
    res_arr.push(entry.creator);
    res_arr.push(entry.id);
    res_arr.push(entry.index.toString());
    res_arr.push(entry.dependencies.length.toString());
    for (const dep of entry.dependencies) {
        res_arr.push(dep);
    }
    const op = entry.operation;
    // Encode the type into base64
    res_arr.push((0, utils_1.toBase64)(op.command));
    for (let i = 0; i < op.args.length; i++) {
        // Encode every argument into base64
        res_arr.push((0, utils_1.toBase64)(op.args[i]));
    }
    return res_arr.join(' ');
}
function _encodeFrontier(f) {
    const res_arr = new Array();
    for (const [creator, count] of f) {
        res_arr.push(creator);
        res_arr.push(count.toString());
    }
    return res_arr.join(' ');
}
function decodeMessage(encMessage) {
    const words = encMessage.split(' ');
    const projectID = words.shift();
    const projectNameEnc = words.shift();
    if (projectID == null || projectNameEnc == null) {
        throw new Error("Message could not be decoded");
    }
    const projectName = (0, utils_1.fromBase64)(projectNameEnc);
    let data = null;
    const datatype = words.shift();
    const data_enc = words.join(' ');
    switch (datatype) {
        case 'e':
            data = _decodeEntry(data_enc);
            break;
        case 'f':
            data = _decodeFrontier(data_enc);
            break;
        default:
            throw new Error("invalid datatype: '" + datatype + "', only 'e' (LogEntry) or 'f' (Frontier) allowed");
    }
    return {
        projectID,
        projectName,
        data,
    };
}
/**
 * This function decodes a string into an entry of an append-only log. This works by splitting the received
 * message string into individual words and translating those to a human readable format.
 *
 * @param encEntry The encoding of the entry
 * @returns The decoded entry
 */
function _decodeEntry(encEntry) {
    const words = encEntry.split(' ');
    const creator = words.shift();
    const id = words.shift();
    const index = Number(words.shift());
    const dep_len = Number(words.shift());
    if (creator == null || id == null || index == null || dep_len == null) {
        throw new Error("Entry could not be decoded");
    }
    const dependencies = Array();
    for (let i = 0; i < dep_len; i++) {
        const dep = words.shift();
        if (dep == null) {
            throw new Error("Entry could not be decoded");
        }
        dependencies.push(dep);
    }
    // Decodes the command
    const cmd_str = words.shift();
    if (cmd_str == null) {
        throw new Error("Entry could not be decoded");
    }
    const command = (0, utils_1.fromBase64)(cmd_str);
    const args = new Array();
    let arg = words.shift();
    while (arg != null) {
        // Decodes the command arguments
        args.push((0, utils_1.fromBase64)(arg));
        arg = words.shift();
    }
    const entry = new append_only_log_1.LogEntry(creator, id, { command, args }, dependencies, index);
    return entry;
}
function _decodeFrontier(encFrontier) {
    const res = new Map();
    if (encFrontier === '') {
        return res;
    }
    const words = encFrontier.split(' ');
    let creator = words.shift();
    let count = Number(words.shift());
    while (creator != null && count != null) {
        res.set(creator, count);
        creator = words.shift();
        count = Number(words.shift());
    }
    if (creator != null || !isNaN(count)) {
        throw new Error("Frontier could not be decoded");
    }
    return res;
}
/**
 * This function binds the socket to a specific port.
 * Just here for convenience as the default doesn't return a promise.
 */
function bindSocket(socket, port) {
    return new Promise((resolve, reject) => {
        socket.once('error', reject);
        socket.bind(port, () => {
            socket.off('error', reject);
            console.log('socket bound to port ' + port);
            resolve();
        });
    });
}
/**
 * This function closes a socket.
 * Just here for convenience as the default doesn't return a promise.
 */
function closeSocket(socket) {
    return new Promise((resolve) => {
        socket.close(() => resolve());
    });
}
/**
 * This function finds the highest possible ip address on a wireless interface network and returns it.
 * TODO make this function return null if it doesn't find a broadcast address.
 *
 * @returns The broadcast ip address
 */
function findBroadcast() {
    const interfaces = os_1.default.networkInterfaces();
    //console.log(interfaces);
    // Iterates over every network interface
    for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        // only wireless connections are allowed
        if (!(name.match('.*Wi-Fi.*') || name.match('.*WLAN.*') || name.match('wl.*'))) {
            console.log('skipped interface ' + name + ' because it is assumed not to be a wireless interface');
            continue;
        }
        // Not sure what info exactly is
        for (const info of iface) {
            // Interface must be ipv4 and not a loop back interface
            if (info.family === 'IPv4' && !info.internal) {
                let ipBits = '';
                let mask = '';
                // Translating the ip address into 32 bits
                info.address.split('.').forEach((byte) => {
                    ipBits = ipBits + Number(byte).toString(2).padStart(8, '0');
                });
                // Translating the network mask into 32 bits
                info.netmask.split('.').forEach((byte) => {
                    // This will invert the original network mask to make it easier to apply to the ip
                    mask = mask + (255 - Number(byte)).toString(2).padStart(8, '0');
                });
                let broadcast = '';
                let tmp = '';
                // Computes bitwise or manually (ts didn't work otherwise) to apply the mask.
                // We want the ip bit not to change if the mask is 0 and to always be 1 if the
                // mask bit is 1. This corresponds to the or operator as seen in the following
                // truth table.
                //
                // mask | ip | result
                //   0  | 0  |   0    
                //   0  | 1  |   1
                //   1  | 0  |   1
                //   1  | 1  |   1
                ipBits.split('').forEach((char, index) => {
                    // computes bitwise or
                    tmp = tmp + (parseInt(char, 2) | parseInt(mask.charAt(index), 2)).toString(2);
                    // turns tmp into a base10 digit every bite and appends it to the broadcast address.
                    if ((index + 1) % 8 == 0) {
                        broadcast = broadcast + parseInt(tmp, 2).toString(10) + '.';
                        tmp = '';
                    }
                });
                broadcast = broadcast.slice(0, -1);
                console.log('determined broadcast address:', broadcast, 'on interface:', name);
                return broadcast;
            }
        }
    }
    throw new Error("No wireless interface found!");
}
/**
 * This function can be used in async functions to make them wait
 *
 * @param ms The duration of the waiting period
 * @returns The void promise to wake up the function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
