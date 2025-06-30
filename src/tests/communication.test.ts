import {encodeCommand, decodeCommand} from "../main/communication";

describe("Communication tests", () => {
    it("Encoding and decoding, simple command", () => {
        let cmd1 = {type: "hello", args: ["bruh", "bruh"]};
        expect(decodeCommand(encodeCommand(cmd1))).toEqual(cmd1);
    });
    it("Encoding and decoding, command with empty strings", () => {
        let cmd2 = {type: "", args: ["", ""]};
        expect(decodeCommand(encodeCommand(cmd2))).toEqual(cmd2);
    });
    it("Encoding and decoding, command with strange arguments", () => {
        let cmd3 = {type: "  ", args: [" ", "\\ "]};
        expect(decodeCommand(encodeCommand(cmd3))).toEqual(cmd3);
    });
    it("Encoding and decoding, command with empty args array", () => {
        let cmd4 = {type: "", args: []};
        expect(decodeCommand(encodeCommand(cmd4))).toEqual(cmd4);
    });
    it("Encoding and decoding, command with strings containing some random codepoints", () => {
        let cmd5 = {type: String.fromCodePoint(1234, 12, 43213), args: [String.fromCodePoint(12,63,2234,63444), String.fromCodePoint(4523,61), String.fromCodePoint(2345,5,6,32234)]};
        expect(decodeCommand(encodeCommand(cmd5))).toEqual(cmd5);
    });
});