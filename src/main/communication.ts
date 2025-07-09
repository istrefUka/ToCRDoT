import dgram, { Socket } from 'dgram';
import { AddressInfo } from 'net';
import { LogEntry, Operation, uuid } from './append_only_log'
import os from 'os';
import { toBase64, fromBase64 } from './utils'

export class Communication {
  private broadcast_ip = findBroadcast();
  private port: number;
  private socket: Socket;
  private projectID: uuid;
  private projectName: string;

  constructor(port: number, broadcast_ip: string | undefined, projectID: uuid, projectName: string) {
    this.socket = dgram.createSocket('udp4');
    if (broadcast_ip) {
      this.broadcast_ip = broadcast_ip;
    }
    this.port = port;
    this.projectID = projectID;
    this.projectName = projectName;
  }

  init(): Promise<void> {
    this.socket = dgram.createSocket('udp4');
    initSocket(this.socket);

    return bindSocket(this.socket, this.port);
  }

  encodeMessage(entry: LogEntry): string {
    let resString = this.projectID;
    resString += ' ' + toBase64(this.projectName);
    resString += ' ' + _encodeEntry(entry);
    return resString;
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
  let resString = entry.creator;
  resString += ' ' + entry.id;
  resString += ' ' + entry.index;
  resString += ' ' + entry.dependencies.length;
  for (const dep of entry.dependencies) {
    resString += ' ' + dep
  }

  const op = entry.operation;

  // Encode the type into base64
  resString += ' ' + toBase64(op.command);

  for (let i = 0; i < op.args.length; i++) {
    // Encode every argument into base64
    resString += ' ' + toBase64(op.args[i]);
  }

  return resString;
}

export function decodeMessage(encMessage: string): { projectID: uuid, projectName: string, entry: LogEntry } {
  const words: string[] = encMessage.split(' ');
  return {
    projectID: words[0],
    projectName: fromBase64(words[1]),
    entry: _decodeEntry(words.slice(2).join(' '))
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
  let curr = 0;

  const creator = words[curr++];
  const id = words[curr++];
  const index = Number(words[curr++]);
  const dep_len = Number(words[curr++]);
  const dependencies = Array<uuid>();
  for (let i = 0; i < dep_len; i++) {
    dependencies.push(words[curr++]);
  }

  // Decodes the command
  const command = fromBase64(words[curr++]);

  const args = new Array<string>();
  while (curr < words.length) {
    // Decodes the command arguments
    args.push(fromBase64(words[curr++]));
  }

  const entry = new LogEntry(creator, id, { command, args }, dependencies, index);
  return entry;
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
