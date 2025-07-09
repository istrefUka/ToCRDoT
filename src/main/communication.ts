import dgram, { Socket } from 'dgram';
import { AddressInfo } from 'net';
import { AppendOnlyLog, Frontier, LogEntry, Operation, uuid } from './append_only_log'
import os from 'os';
import { toBase64, fromBase64 } from './utils'

export class Communication {
  private broadcast_ip = findBroadcast();
  private port: number;
  private socket: Socket;
  private projectID: uuid;
  private projectName: string;
  private appendOnlyLog: AppendOnlyLog;

  constructor(port: number, broadcast_ip: string | undefined, projectID: uuid, projectName: string, appendOnlyLog: AppendOnlyLog) {
    this.socket = dgram.createSocket('udp4');
    if (broadcast_ip) {
      this.broadcast_ip = broadcast_ip;
    }
    this.port = port;
    this.projectID = projectID;
    this.projectName = projectName;
    this.appendOnlyLog = appendOnlyLog;
  }

  init(): Promise<void> {
    this.socket = dgram.createSocket('udp4');
    initSocket(this.socket);

    return bindSocket(this.socket, this.port);
  }

  encodeMessage(data: LogEntry | Frontier): string {
    const res_arr = new Array<string>();
    res_arr.push(this.projectID);
    res_arr.push(toBase64(this.projectName));
    if (data instanceof LogEntry) {
      res_arr.push('e')
      res_arr.push(_encodeEntry(data));
    } else if (data instanceof Map) {
      res_arr.push('f')
      res_arr.push(_encodeFrontier(data as Frontier));
    } else {
      throw new Error('Message could not be encoded');
    }
    //console.log("encoded message: " + res_arr.join(' '));
    return res_arr.join(' ');
  }

  setBroadcastIP(broadcast_ip: string): void {
    this.broadcast_ip = broadcast_ip;
  }

  setPort(port: number): Promise<void> {
    return new Promise<void>(
      (resolve) => {
        const r = async () => {
          const newSocket = dgram.createSocket('udp4');
          initSocket(newSocket);
          await bindSocket(newSocket, port);
          this.socket = newSocket;
          resolve();
        }
        if (this.socket) {
          closeSocket(this.socket).then(r)
        } else {
          r();
        }
      }
    )
  }

  /**
   * This method sends an entry of an append-only log to a specified ip.
   * 
   * @param entry The entry to be sent
   */
  sendMessage(entry: LogEntry): void {
    try {
      const enc: Buffer = Buffer.from(this.encodeMessage(entry), 'utf8');
      this.socket.send(enc, this.port, this.broadcast_ip);
      console.log('sent message:', enc.toString('utf-8'), 'to', this.broadcast_ip, this.port);
    } catch (error) {
      console.log('Error:', error, '\nSending entry:', entry);
    }
  }

  /**
   * This function sends a junk message to the broadcast ip every second. Later to be used to send frontiers.
   */
  async messageLoop() {
    let msgIndex = 0;
    const cmd: Operation = {
      command: 'cmd1',
      args: [msgIndex.toString(), 'junk', 'junk'],
    };

    while (msgIndex < 10) {
      this.sendMessage(new LogEntry('bigP', 'entry1', cmd, [], 0));
      msgIndex++;
      cmd.args[0] = msgIndex.toString();
      await sleep(1000);
    }
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

// TODO this function has to be integrated with the append-only log.
function initSocket(socket: Socket): void {
  // This event prints and error message and closes the socket.
  socket.on('error', (err) => {
    console.error('client error:', err.stack);
    socket.close();
  })

  // This event decodes the received message and logs it.
  socket.on('message', (msg, rinfo) => {
    const received: string = msg.toString('utf8');
    const decoded_msg = decodeMessage(received);
    console.log('received message:', decoded_msg, 'from', rinfo.address, rinfo.port);
  })

  // This event logs where the instance is listening on.
  socket.on('listening', () => {
    if (socket == null) {
      throw new Error('Socket undefined');
    }
    const address: AddressInfo = socket.address();
    console.log('listening on:', address.address, ':', address.port);
  })
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
    if (!(name.match('.*Wi-Fi.*') || name.match('.*WLAN.*') || name.match('wl.*'))) {
      console.log('skipped interface ' + name + ' because it is assumed not to be a wireless interface');
      continue;
    }

    // Not sure what info exactly is
    for (const info of iface) {
      // Interface must be ipv4 and not a loop back interface
      if (info.family === 'IPv4' && !info.internal) {
        let ipBits: string = '';
        let mask: string = '';

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
