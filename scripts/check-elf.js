const fs = require('fs');

if (process.argv.length < 3) {
    console.log('Usage: node check-elf.js <path_to_so>');
    process.exit(1);
}

const filePath = process.argv[2];
const buffer = fs.readFileSync(filePath);

// Check ELF Magic
if (buffer[0] !== 0x7f || buffer[1] !== 0x45 || buffer[2] !== 0x4c || buffer[3] !== 0x46) {
    console.log('Not an ELF file');
    process.exit(1);
}

const is64 = buffer[4] === 2; // 1 = 32-bit, 2 = 64-bit
const endian = buffer[5]; // 1 = Little, 2 = Big

console.log(`Class: ${is64 ? '64-bit' : '32-bit'}`);
console.log(`Data: ${endian === 1 ? 'Little Endian' : 'Big Endian'}`);

// Parse Header based on bitness
let phoff, phentsize, phnum;

if (is64) {
    phoff = Number(buffer.readBigUInt64LE(32)); // e_phoff
    phentsize = buffer.readUInt16LE(54);      // e_phentsize
    phnum = buffer.readUInt16LE(56);          // e_phnum
} else {
    phoff = buffer.readUInt32LE(28);
    phentsize = buffer.readUInt16LE(42);
    phnum = buffer.readUInt16LE(44);
}

console.log(`Program Header Offset: ${phoff}`);
console.log(`Program Header Entry Size: ${phentsize}`);
console.log(`Program Header Count: ${phnum}`);

let maxAlign = 0;

for (let i = 0; i < phnum; i++) {
    const offset = phoff + (i * phentsize);
    const type = buffer.readUInt32LE(offset);

    // PT_LOAD is type 1
    if (type === 1) {
        let align;
        if (is64) {
            align = Number(buffer.readBigUInt64LE(offset + 48)); // p_align is at offset 48 for 64-bit
        } else {
            align = buffer.readUInt32LE(offset + 28); // p_align is at offset 28 for 32-bit
        }

        console.log(`Segment ${i} (PT_LOAD): Align = 0x${align.toString(16)} (${align})`);
        if (align > maxAlign) maxAlign = align;
    }
}

if (maxAlign >= 16384) {
    console.log('✅ ALIGNMENT PASS: 16KB or greater found.');
    process.exit(0);
} else {
    console.log('❌ ALIGNMENT FAIL: Max alignment is less than 16KB.');
    process.exit(1);
}
