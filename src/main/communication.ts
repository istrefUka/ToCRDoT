import dgram, { Socket } from 'dgram';
import { AddressInfo } from 'net';
import os from 'os';
import { resolve } from 'path';

let broadcast = findBroadcast();
let socket: Socket | undefined;

/**
 * This type stores command name and arguments, for example {type: create project, args { Alex, DPI }}.
 */
type Command = {
  type: string;
  args: string[];
}

/**
 * This function encodes a command into a string where every "word is in base64". This works by first
 * turning every word into its base64 representation to get rid of whitespaces and then concatenating
 * everything into a string.
 * 
 * @param command The command to be encoded
 * @returns The string encoding of the command
 */
export function encodeCommand(command: Command) :string {
  // Encode the type into base64
  let cmdString: string = Buffer.from(command.type, 'utf8').toString('base64');

  for(let i = 0; i < command.args.length; i++) {
    // Encode every argument into base64
    cmdString = cmdString + ' ' + Buffer.from(command.args[i], 'utf8').toString('base64');
  }

  return cmdString;
}


/**
 * This function decodes a string in base64 into a command. This works by splitting the received
 * message string into individual words and translating those to a human readable format.
 * 
 * @param cmdString The encoding of the command
 * @returns The decoded command
 */
export function decodeCommand(cmdString: string) :Command {
  let command: Command = {type: '', args: []};
  let cmd64: string[] = cmdString.split(' ');

  // Decodes the command type
  command.type = Buffer.from(cmd64[0], 'base64').toString('utf8');

  for(let i = 1; i < cmd64.length; i++) {
    // Decodes the command arguments
    command.args[i-1] = Buffer.from(cmd64[i], 'base64').toString('utf8');
  }

  return command;
}

function bindSocket(socket: Socket, port: number) {
  return new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(port, () => {
      socket.off('error', reject);
      console.log("socket bound to port " + port)
      resolve();
    });
  });
}

function closeSocket(socket: Socket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    socket.close(() => resolve());
  });
}

function initSocket(socket: Socket): void {
  // This event prints and error message and closes the socket.
  socket.on('error', (err) => {
    console.error('client error:', err.stack);
    socket?.close();
  })

  // This event decodes the received message and logs it.
  socket.on('message', (msg, rinfo) => {
    let received: string = msg.toString('utf8');
    let command = decodeCommand(received);
    console.log('received command:', command, "from", rinfo.address, rinfo.port);
  })

  // This event logs where the instance is listening on.
  socket.on('listening', () => {
    if (socket == null) {
      throw new Error("Socket undefined");
    }
    const address: AddressInfo = socket.address();
    console.log('listening on:', address.address, ':', address.port);
  })

}

/**
 * This function binds the socket to a specific port.
 * Sets the socket up for communication.
 * If no port is given, the port 8080 is used.
 */
export function initCommunication(broadcast_ip?: string, port?: number): Promise<void> {
  if (port == null) {
    port = 8080;
  }
  if (broadcast_ip) {
    broadcast = broadcast_ip;
  }
  socket = dgram.createSocket('udp4');
  initSocket(socket);

  return bindSocket(socket, port);
}

export function setBroadcastIP(broadcast_ip: string) {
  broadcast = broadcast_ip;
}

export function setPort(port: number) {
  return new Promise<void>(
    async (resolve) => {
      if (socket) await closeSocket(socket);
      const newSocket = dgram.createSocket('udp4');
      initSocket(newSocket);
      await bindSocket(newSocket, port);
      socket = newSocket;
      resolve();
    }
  )
}

/**
 * This function finds the highest possible ip address on the network and returns it.
 * 
 * @returns The broadcast ip address
 */
function findBroadcast() :string {
  let interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces();
  //console.log(interfaces);

  // Iterates over every network interface
  for(let name of Object.keys(interfaces)) {
    let iface = interfaces[name]!;

    // only wireless connections are allowed
    if(!(name.match(".*Wi-Fi.*") || name.match(".*WLAN.*") || name.match("wl.*"))) {
      console.log("skipped interface " + name + " because it is assumed not to be a wireless interface");
      continue;
    }

    // Not sure what info exactly is
    for(let info of iface) {
      // Interface must be ipv4 and not a loop back interface
      if(info.family === 'IPv4' && !info.internal) {
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
          if((index+1) % 8 == 0) {
            broadcast = broadcast + parseInt(tmp, 2).toString(10) + '.'
            tmp = '';
          }
        });

        broadcast = broadcast.slice(0, -1);
        console.log('determined broadcast adress:', broadcast, "on interface:", name);
        return broadcast;
      }
    }
  }

  return '';
}

/**
 * This function sends a command to a specified ip.
 * 
 * @param command The command to be sent
 */
function sendMessage(command: Command, ip: string) :void {
  if (socket == null) {
    throw new Error("Socket uninitialized");
  }
  try {
    let enc: Buffer = Buffer.from(encodeCommand(command), 'utf8');
    socket.send(enc, socket.address().port, ip);
    console.log('sent command:', command.type, command.args, "on port", socket.address().port, ":", ip);
  } catch(error) {
    console.log('Error:', error, '\nSending command:', command);
  }
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

/**
 * This function sends a junk message to the broadcast ip every second. Later to be used to send frontiers.
 */
export async function messageLoop() {
  let msgIndex = 0;
  let cmd: Command = {
      type: 'Big P',
      args: [msgIndex.toString(), 'junk', 'junk'],
    };

  while(msgIndex < 10) {
    sendMessage(cmd, broadcast);
    msgIndex++;
    cmd.args[0] = msgIndex.toString();
    await sleep(1000);
  }
}
