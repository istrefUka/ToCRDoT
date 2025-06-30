import dgram, { Socket } from 'dgram';
import { AddressInfo } from 'net';
import os from 'os';

const port: number = 8080;
const broadcast = findBroadcast();
const socket: Socket = dgram.createSocket('udp4');

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
function encodeCommand(command: Command) :string {
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
function decodeCommand(cmdString: string) :Command {
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

/**
 * This function binds the socket to a specific port.
 */
export function bindSocket() {
    socket.bind(port);
}

/**
 * This function finds the highest possible ip address on the network and returns it.
 * 
 * @returns The broadcast ip address
 */
function findBroadcast() :string {
  let interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces();

  // Itterates over every network interface
  for(let name of Object.keys(interfaces)) {
    let iface = interfaces[name];
    if(!iface) continue;

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
        console.log('determined broadcast adress:', broadcast);
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
  let enc: Buffer = Buffer.from(encodeCommand(command), 'utf8');

  socket.send(enc, port, ip);
  console.log('sent command:', command.type, command.args);
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

  while(true) {
    sendMessage(cmd, broadcast);
    msgIndex++;
    cmd.args[0] = msgIndex.toString();
    await sleep(1000);
  }
}

/**
 * This event prints and error message and closes the socket.
 */
socket.on('error', (err) => {
  console.error('client error:', err.stack);
  socket.close();
})

/**
 * This event decodes the received message and logs it.
 */
socket.on('message', (msg, rinfo) => {
  let received: string = msg.toString('utf8');
  let command = decodeCommand(received);
  console.log('received command:', command);
})

/**
 * This event logs where the instance is listening on.
 */
socket.on('listening', () => {
  const address: AddressInfo = socket.address();
  console.log('listening on:', address.address, ':', address.port);
})