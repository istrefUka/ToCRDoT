import dgram, { Socket } from 'dgram';
import { AddressInfo } from 'net';
import { AppendOnlyLog, Frontier, LogEntry, Operation, uuid } from './append_only_log'
import os from 'os';
import { toBase64, fromBase64, mapReplacer, isLogEntry, isFrontier } from './utils'

/**
 * TODO (if there is time) implement callback to notify user when the ip and the port were successfully set in the actual socket with the actual ip and port of the socket. 
 */
class BaseCommunication {
  public broadcast_ip: string;
  public socket: Socket;
  private _port: number;
  private onMessageCallback: ((msg: string, rinfo: MessageInfo) => void) | undefined = undefined;

  constructor(broadcast_ip: string | undefined, port: number) {
    this.socket = dgram.createSocket('udp4');
    this.broadcast_ip = broadcast_ip ?? findBroadcast();
    this._port = port;
  }

  init(): Promise<void> {
    this.socket = dgram.createSocket('udp4');
    if(this.onMessageCallback != null) {
      this.onMessage(this.onMessageCallback);
    }
    this.initSocket();

    return bindSocket(this.socket, this._port);
  }

  close(): Promise<void> {
    return closeSocket(this.socket);
  }

  private initSocket() {
    // This event prints and error message and closes the socket.
    this.socket.on('error', (err) => {
      console.error('client error:', err.stack);
      this.socket.close();
    })

    // This event logs where the instance is listening on.
    this.socket.on('listening', () => {
      const address: AddressInfo = this.socket.address();
      console.log('listening on:', address.address, ':', address.port);
    })
  }

  get port() {
    return this._port;
  }

  send(msg: Buffer) {
    this.socket.send(msg);
    console.log('sent message:', msg.toString('utf-8'), 'to', this.broadcast_ip, this._port);
  }

  /**
   * This method replaces the callback that is currently used when a message arrives with the new callback. 
   * @param onMessageCallback callback to be called when a message arrives
   */
  onMessage(onMessageCallback: (msg: string, rinfo: MessageInfo) => void) {
    if (this.onMessageCallback != null) {
      this.socket.off('message', this.onMessageCallback);
    }
    this.socket.on('message', (msg, rinfo) => {
      onMessageCallback(msg.toString(), rinfo);
    });
    this.onMessageCallback = onMessageCallback;
  }

  setBroadcastIP(broadcast_ip: string): void {
    this.broadcast_ip = broadcast_ip;
  }

  setPort(port: number): Promise<void> {
    return (async () => {
      await closeSocket(this.socket);
      this.socket = dgram.createSocket('udp4');
      this.initSocket();
      if (this.onMessageCallback != null) {
        this.onMessage(this.onMessageCallback);
      }
      await bindSocket(this.socket, port);
      this._port = port;
    })();
  }
}

/**
 * This class implements the communication necessary for when a project is open. 
 */
export class ProjectCommunication {
  private projectID: uuid;
  private projectName: string;
  private appendOnlyLog: AppendOnlyLog;
  private crdt_update_callback: (ops: Operation[]) => void;
  public delay_ms: number;
  private communication: BaseCommunication;

  /**
   * The init-method should be called after this constructor. 
   * @param port 
   * @param broadcast_ip 
   * @param projectID UUID of project that is currently open
   * @param projectName 
   * @param appendOnlyLog append-only log that the crdt-object shall use. 
   * @param crdt_update_callback this callback is executed when the append-only log changes. It receives the changes as operations since the last update. 
   */
  constructor(port: number, broadcast_ip: string | undefined, projectID: uuid, projectName: string, appendOnlyLog: AppendOnlyLog, crdt_update_callback: (ops: Operation[]) => void) {
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

  close(): Promise<void> {
    return this.communication.close();
  }

  init(): Promise<void> {
    return (async () => {
      await this.communication.init();
      this.communication.onMessage((msg, rinfo) => {
        const decoded_msg = decodeMessage(msg);
        if (decoded_msg.projectID !== this.projectID) {
          return;
        }
        console.log('received message:', msg);
        console.log('received message (decoded):', decoded_msg, 'from', rinfo.address, rinfo.port);
        const o = this.appendOnlyLog.get_frontier();
        this.handleMessage(decoded_msg);
        this.crdt_update_callback(this.appendOnlyLog.query_missing_operations_ordered(o))
      })
    })();
  }

  handleMessage(msg: { projectID: uuid, projectName: string, data: LogEntry | Frontier }) {
    if (isLogEntry(msg.data)) {
      this.appendOnlyLog.update([msg.data]);
      this.appendOnlyLog.save();
    } else if (isFrontier(msg.data)) {
      const frontier = msg.data as Frontier;
      for (const entry of this.appendOnlyLog.query_missing_entries_ordered(frontier)) {
        this.sendMessage(entry);
      }
    } else {
      throw new Error("Message invalid");
    }
  }

  sendFrontier() {
    this.sendMessage(this.appendOnlyLog.get_frontier());
  }

  encodeMessage(data: LogEntry | Frontier): string {
    const res_arr = new Array<string>();
    res_arr.push(this.projectID);
    res_arr.push(toBase64(this.projectName));
    if (isLogEntry(data)) {
      res_arr.push('e')
      res_arr.push(_encodeEntry(data));
    } else if (isFrontier(data)) {
      res_arr.push('f')
      res_arr.push(_encodeFrontier(data as Frontier));
    } else {
      throw new Error('Message could not be encoded');
    }
    //console.log("encoded message: " + res_arr.join(' '));
    return res_arr.join(' ');
  }

  setBroadcastIP(broadcast_ip: string): void {
    this.communication.setBroadcastIP(broadcast_ip);
  }

  setPort(port: number): Promise<void> {
    return this.communication.setPort(port);
  }

  /**
   * This method sends an entry of an append-only log to a specified ip.
   * 
   * @param data The entry to be sent
   */
  sendMessage(data: LogEntry | Frontier): void {
    try {
      const enc: Buffer = Buffer.from(this.encodeMessage(data), 'utf8');
      this.communication.send(enc);
    } catch (error) {
      console.log('Error:', error, '\nSending entry:', data);
    }
  }

  /**
   * This method sends the frontier repeatedly with the delay specified in this.delay_ms.
   */
  async messageLoop() {
    for (;;) {
      this.sendMessage(this.appendOnlyLog.get_frontier());
      await sleep(this.delay_ms);
    }
  }
}

/**
 * This class is used to listen for other projects on a given interface. 
 * Use the init-method to specify in a callback what happens when a message is received and start listening. 
 */
export class ProjectListener {
  private communication: BaseCommunication;

  /**
   * Set initial interface of communication. 
   * @param broadcast_ip broadcast-ip to use for receiving. If undefined, it tries to find a broadcast-ip on it's own. 
   * @param port 
   */
  constructor(broadcast_ip: string | undefined, port: number) {
    this.communication = new BaseCommunication(broadcast_ip, port);
  }

  /**
   * Initialize the listening with a callback. 
   * @param onMessageCallback This is the callback for when a message arrives. NOTE: should be used for creating a popup 
   */
  init(onMessageCallback: (preview: ProjectPreview, rinfo: MessageInfo) => void) {
    const messageCallback = (msg: string, rinfo: MessageInfo): void => {
      const dec_msg = decodeMessage(msg);
      const projPreview = {
        projectID: dec_msg.projectID,
        projectTitle: dec_msg.projectName,
      };
      onMessageCallback(projPreview, rinfo);
    }
    this.communication.init();
    this.communication.onMessage(messageCallback);
  }

  get port() {
    return this.communication.port;
  }

  get broadcast_ip() {
    return this.communication.broadcast_ip;
  }

  setPort(port: number): Promise<void> {
    return this.communication.setPort(port);
  }

  setBroadcastIP(broadcast_ip: string) {
    this.communication.setBroadcastIP(broadcast_ip);
  }

  close() {
    this.communication.close();
  }

  open() {
    this.communication.init();
  }
}


/**
 * This function encodes a command into a string. This works by first converting 
 * the strings that possibly contain spaces into base64 and concatenate them with 
 * spaces in between. 
 * 
 * @param entry The command to be encoded
 * @returns The string encoding of the command
 */
export function _encodeEntry(entry: LogEntry): string {
  // Encode the relevant fields
  // no base64 necessary as ids are assumed to have no spaces
  const res_arr = new Array<string>()
  res_arr.push(entry.creator);
  res_arr.push(entry.id);
  res_arr.push(entry.index.toString());
  res_arr.push(entry.dependencies.length.toString());
  for (const dep of entry.dependencies) {
    res_arr.push(dep);
  }

  const op = entry.operation;
  // Encode the type into base64
  res_arr.push(toBase64(op.command));
  for (let i = 0; i < op.args.length; i++) {
    // Encode every argument into base64
    res_arr.push(toBase64(op.args[i]));
  }
  return res_arr.join(' ');
}

function _encodeFrontier(f: Frontier): string {
  const res_arr = new Array<string>();
  for (const [creator, count] of f) {
    res_arr.push(creator);
    res_arr.push(count.toString());
  }
  return res_arr.join(' ');
}

export function decodeMessage(encMessage: string): { projectID: uuid, projectName: string, data: LogEntry | Frontier } {
  const words: string[] = encMessage.split(' ');
  const projectID = words.shift();
  const projectNameEnc = words.shift();
  if (projectID == null || projectNameEnc == null) {
    throw new Error("Message could not be decoded");
  }
  const projectName = fromBase64(projectNameEnc);
  let data = null;
  const datatype = words.shift();
  const data_enc = words.join(' ');
  switch (datatype) {
    case 'e':
      data = _decodeEntry(data_enc)
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
export function _decodeEntry(encEntry: string): LogEntry {
  const words: string[] = encEntry.split(' ');

  const creator = words.shift();
  const id = words.shift();
  const index = Number(words.shift());
  const dep_len = Number(words.shift());
  if (creator == null || id == null || index == null || dep_len == null) {
    throw new Error("Entry could not be decoded");
  }
  const dependencies = Array<uuid>();
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
  const command = fromBase64(cmd_str);

  const args = new Array<string>();
  let arg = words.shift();
  while (arg != null) {
    // Decodes the command arguments
    args.push(fromBase64(arg));
    arg = words.shift();
  }

  const entry = new LogEntry(creator, id, { command, args }, dependencies, index);
  return entry;
}

function _decodeFrontier(encFrontier: string): Frontier {
  const res = new Map<uuid, number>();
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
function bindSocket(socket: Socket, port: number) {
  return new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(port, () => {
      socket.off('error', reject);
      console.log('socket bound to port ' + port)
      resolve();
    });
  });
}

/**
 * This function closes a socket.
 * Just here for convenience as the default doesn't return a promise. 
 */
function closeSocket(socket: Socket): Promise<void> {
  return new Promise<void>((resolve) => {
    socket.close(() => resolve());
  });
}


/**
 * This function finds the highest possible ip address on a wireless interface network and returns it.
 * TODO make this function return null if it doesn't find a broadcast address.
 * 
 * @returns The broadcast ip address
 */
function findBroadcast(): string {
  const interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces();
  //console.log(interfaces);

  // Iterates over every network interface
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name]!;

    // only wireless connections are allowed
    if (!(name.match('.*Wi-Fi.*') || name.match('.*WLAN.*') || name.match('wl.*') || name.match("en0"))) {
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
        let tmp = ''

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
            broadcast = broadcast + parseInt(tmp, 2).toString(10) + '.'
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
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
