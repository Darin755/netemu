importScripts("libs/v86/libv86.js");

//startup
var emulator = new V86({
    wasm_path: "libs/v86/v86.wasm",
    memory_size: 128 * 1024 * 1024,
    bios: {
        url: "libs/bios/seabios.bin",
    },
    hda: {
        url: "libs/openwrt/openwrt-23.05.4-842eb409e51b-x86-legacy-generic-squashfs-combined.img.zst",
        size: 126353408
    },
    autostart: true,
});

//get mac
emulator.add_listener("net0-mac", function(mac) {
    emulator.mac = mac;
    //post mac
   // postMessage({
     //   mac: mac,
      //  boot: emulator.booted
   // });
});

//capture out going
emulator.add_listener("net0-send", function(packet) {
    postMessage({
      //  mac: emulator.mac,
        packet: packet
    });
});

//wait until boot
//once booted send back output of commands
var shellout = "";//current output
var commandqueue = [];

emulator.add_listener("serial0-output-byte", function(byte) {
    var char = String.fromCharCode(byte);
    if(char == '\r') {
        return;
    } else if(shellout.endsWith("#") && ((shellout.search("root@") >= 0))) {
        if(emulator.shellready == true) {
            //only send back data if commands were run
            var arr = shellout.split("\n");//array of output lines
            arr = arr.slice(1,arr.length-1);
            postMessage({ //send output back
                cmdout: arr
            });

        }
        emulator.shellready = true;
        emulator.readyforcommands = true;//set booted flag
        shellout = "";//clear output

        //run new commands from queue
        if(emulator.readyforcommands && commandqueue.length > 0) { //added readyforcommands check just in case
            emulator.readyforcommands = false;
            emulator.serial0_send(commandqueue.splice(0,1)+"\n");
        }
    } else if(shellout.endsWith("Please press Enter to activate this console.")) {
        shellout = "";
        emulator.serial0_send("\n");
        //first boot
        //send back status
        if(emulator.booted != true) {
            emulator.booted = true;
            postMessage({
                boot: emulator.booted
            });
        }

    } else {
        shellout+=char;
    }

});

function newCommands() {
    if(emulator.readyforcommands == true) {
        emulator.serial0_send(commandqueue.splice(0,1)+"\n");
        emulator.readyforcommands = false;
    }
}

this.onmessage = function(e)
{
    //incoming traffic
    if(e.data.packet) {
        //send direct packet
        emulator.bus.send("net0-receive", e.data.packet);
    } else if(e.data.cmd) {//incoming command
            //add commands to the queue
            commandqueue.push(e.data.cmd);
            //call handler
            newCommands();
    
        }
};

function a2ethaddr(bytes) {
    return [0,1,2,3,4,5].map((i) => bytes[i].toString(16)).map(x => x.length === 1 ? "0" + x : x).join(":");
};