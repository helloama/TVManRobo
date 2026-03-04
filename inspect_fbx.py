import struct, os, sys

FBX_DIR = os.path.join("D:/TVRoboPhetta/public/models/animations")

class FBXReader:
    def __init__(self, data):
        self.data = data
        self.pos = 0
    def ru8(self):
        v = struct.unpack_from("<B", self.data, self.pos)[0]; self.pos += 1; return v
    def ri16(self):
        v = struct.unpack_from("<h", self.data, self.pos)[0]; self.pos += 2; return v
    def ri32(self):
        v = struct.unpack_from("<i", self.data, self.pos)[0]; self.pos += 4; return v
    def ru32(self):
        v = struct.unpack_from("<I", self.data, self.pos)[0]; self.pos += 4; return v
    def ri64(self):
        v = struct.unpack_from("<q", self.data, self.pos)[0]; self.pos += 8; return v
    def ru64(self):
        v = struct.unpack_from("<Q", self.data, self.pos)[0]; self.pos += 8; return v
    def rf32(self):
        v = struct.unpack_from("<f", self.data, self.pos)[0]; self.pos += 4; return v
    def rf64(self):
        v = struct.unpack_from("<d", self.data, self.pos)[0]; self.pos += 8; return v
    def rstr(self, n):
        s = self.data[self.pos:self.pos+n]; self.pos += n; return s
    def rbytes(self, n):
        b = self.data[self.pos:self.pos+n]; self.pos += n; return b