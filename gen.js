const fs=require("fs");
const s=fs.readFileSync("D:/TVRoboPhetta/inspect_fbx_b64.txt","utf8");
fs.writeFileSync("D:/TVRoboPhetta/inspect_fbx.py",Buffer.from(s,"base64"));
console.log("Done");
