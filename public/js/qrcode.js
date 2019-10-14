function QR8bitByte(data) {
    this.mode = QRMode.MODE_8BIT_BYTE
    this.data = data
}

QR8bitByte.prototype = {

    getLength: function (buffer) {
        return this.data.length
    },

    write: function (buffer) {
        for (var i = 0; i < this.data.length; i++) {
            // not JIS ...
            buffer.put(this.data.charCodeAt(i), 8)
        }
    }
}

//---------------------------------------------------------------------
// QRCode
//---------------------------------------------------------------------

function QRCode(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber
    this.errorCorrectLevel = errorCorrectLevel
    this.modules = null
    this.moduleCount = 0
    this.dataCache = null
    this.dataList = new Array()
}

QRCode.prototype = {

    addData: function (data) {
        var newData = new QR8bitByte(data)
        this.dataList.push(newData)
        this.dataCache = null
    },

    isDark: function (row, col) {
        if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
            throw new Error(row + ',' + col)
        }
        return this.modules[row][col]
    },

    getModuleCount: function () {
        return this.moduleCount
    },

    make: function () {
        // Calculate automatically typeNumber if provided is < 1
        if (this.typeNumber < 1) {
            var typeNumber = 1
            for (typeNumber = 1; typeNumber < 40; typeNumber++) {
                var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel)

                var buffer = new QRBitBuffer()
                var totalDataCount = 0
                for (var i = 0; i < rsBlocks.length; i++) {
                    totalDataCount += rsBlocks[i].dataCount
                }

                for (var i = 0; i < this.dataList.length; i++) {
                    var data = this.dataList[i]
                    buffer.put(data.mode, 4)
                    buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber))
                    data.write(buffer)
                }
                if (buffer.getLengthInBits() <= totalDataCount * 8)
                    break
            }
            this.typeNumber = typeNumber
        }
        this.makeImpl(false, this.getBestMaskPattern())
    },

    makeImpl: function (test, maskPattern) {

        this.moduleCount = this.typeNumber * 4 + 17
        this.modules = new Array(this.moduleCount)

        for (var row = 0; row < this.moduleCount; row++) {

            this.modules[row] = new Array(this.moduleCount)

            for (var col = 0; col < this.moduleCount; col++) {
                this.modules[row][col] = null//(col + row) % 3;
            }
        }

        this.setupPositionProbePattern(0, 0)
        this.setupPositionProbePattern(this.moduleCount - 7, 0)
        this.setupPositionProbePattern(0, this.moduleCount - 7)
        this.setupPositionAdjustPattern()
        this.setupTimingPattern()
        this.setupTypeInfo(test, maskPattern)

        if (this.typeNumber >= 7) {
            this.setupTypeNumber(test)
        }

        if (this.dataCache == null) {
            this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList)
        }

        this.mapData(this.dataCache, maskPattern)
    },

    setupPositionProbePattern: function (row, col) {

        for (var r = -1; r <= 7; r++) {

            if (row + r <= -1 || this.moduleCount <= row + r) continue

            for (var c = -1; c <= 7; c++) {

                if (col + c <= -1 || this.moduleCount <= col + c) continue

                if ((0 <= r && r <= 6 && (c == 0 || c == 6))
                    || (0 <= c && c <= 6 && (r == 0 || r == 6))
                    || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                    this.modules[row + r][col + c] = true
                } else {
                    this.modules[row + r][col + c] = false
                }
            }
        }
    },

    getBestMaskPattern: function () {

        var minLostPoint = 0
        var pattern = 0

        for (var i = 0; i < 8; i++) {

            this.makeImpl(true, i)

            var lostPoint = QRUtil.getLostPoint(this)

            if (i == 0 || minLostPoint > lostPoint) {
                minLostPoint = lostPoint
                pattern = i
            }
        }

        return pattern
    },

    setupTimingPattern: function () {

        for (var r = 8; r < this.moduleCount - 8; r++) {
            if (this.modules[r][6] != null) {
                continue
            }
            this.modules[r][6] = (r % 2 == 0)
        }

        for (var c = 8; c < this.moduleCount - 8; c++) {
            if (this.modules[6][c] != null) {
                continue
            }
            this.modules[6][c] = (c % 2 == 0)
        }
    },

    setupPositionAdjustPattern: function () {

        var pos = QRUtil.getPatternPosition(this.typeNumber)

        for (var i = 0; i < pos.length; i++) {

            for (var j = 0; j < pos.length; j++) {

                var row = pos[i]
                var col = pos[j]

                if (this.modules[row][col] != null) {
                    continue
                }

                for (var r = -2; r <= 2; r++) {

                    for (var c = -2; c <= 2; c++) {

                        if (r == -2 || r == 2 || c == -2 || c == 2
                            || (r == 0 && c == 0)) {
                            this.modules[row + r][col + c] = true
                        } else {
                            this.modules[row + r][col + c] = false
                        }
                    }
                }
            }
        }
    },

    setupTypeNumber: function (test) {

        var bits = QRUtil.getBCHTypeNumber(this.typeNumber)

        for (var i = 0; i < 18; i++) {
            var mod = (!test && ((bits >> i) & 1) == 1)
            this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod
        }

        for (var i = 0; i < 18; i++) {
            var mod = (!test && ((bits >> i) & 1) == 1)
            this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod
        }
    },

    setupTypeInfo: function (test, maskPattern) {

        var data = (this.errorCorrectLevel << 3) | maskPattern
        var bits = QRUtil.getBCHTypeInfo(data)

        // vertical
        for (var i = 0; i < 15; i++) {

            var mod = (!test && ((bits >> i) & 1) == 1)

            if (i < 6) {
                this.modules[i][8] = mod
            } else if (i < 8) {
                this.modules[i + 1][8] = mod
            } else {
                this.modules[this.moduleCount - 15 + i][8] = mod
            }
        }

        // horizontal
        for (var i = 0; i < 15; i++) {

            var mod = (!test && ((bits >> i) & 1) == 1)

            if (i < 8) {
                this.modules[8][this.moduleCount - i - 1] = mod
            } else if (i < 9) {
                this.modules[8][15 - i - 1 + 1] = mod
            } else {
                this.modules[8][15 - i - 1] = mod
            }
        }

        // fixed module
        this.modules[this.moduleCount - 8][8] = (!test)

    },

    mapData: function (data, maskPattern) {

        var inc = -1
        var row = this.moduleCount - 1
        var bitIndex = 7
        var byteIndex = 0

        for (var col = this.moduleCount - 1; col > 0; col -= 2) {

            if (col == 6) col--

            while (true) {

                for (var c = 0; c < 2; c++) {

                    if (this.modules[row][col - c] == null) {

                        var dark = false

                        if (byteIndex < data.length) {
                            dark = (((data[byteIndex] >>> bitIndex) & 1) == 1)
                        }

                        var mask = QRUtil.getMask(maskPattern, row, col - c)

                        if (mask) {
                            dark = !dark
                        }

                        this.modules[row][col - c] = dark
                        bitIndex--

                        if (bitIndex == -1) {
                            byteIndex++
                            bitIndex = 7
                        }
                    }
                }

                row += inc

                if (row < 0 || this.moduleCount <= row) {
                    row -= inc
                    inc = -inc
                    break
                }
            }
        }

    }

}

QRCode.PAD0 = 0xEC
QRCode.PAD1 = 0x11

QRCode.createData = function (typeNumber, errorCorrectLevel, dataList) {

    var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel)

    var buffer = new QRBitBuffer()

    for (var i = 0; i < dataList.length; i++) {
        var data = dataList[i]
        buffer.put(data.mode, 4)
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber))
        data.write(buffer)
    }

    // calc num max data.
    var totalDataCount = 0
    for (var i = 0; i < rsBlocks.length; i++) {
        totalDataCount += rsBlocks[i].dataCount
    }

    if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw new Error('code length overflow. ('
            + buffer.getLengthInBits()
            + '>'
            + totalDataCount * 8
            + ')')
    }

    // end code
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4)
    }

    // padding
    while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false)
    }

    // padding
    while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
            break
        }
        buffer.put(QRCode.PAD0, 8)

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
            break
        }
        buffer.put(QRCode.PAD1, 8)
    }

    return QRCode.createBytes(buffer, rsBlocks)
}

QRCode.createBytes = function (buffer, rsBlocks) {

    var offset = 0

    var maxDcCount = 0
    var maxEcCount = 0

    var dcdata = new Array(rsBlocks.length)
    var ecdata = new Array(rsBlocks.length)

    for (var r = 0; r < rsBlocks.length; r++) {

        var dcCount = rsBlocks[r].dataCount
        var ecCount = rsBlocks[r].totalCount - dcCount

        maxDcCount = Math.max(maxDcCount, dcCount)
        maxEcCount = Math.max(maxEcCount, ecCount)

        dcdata[r] = new Array(dcCount)

        for (var i = 0; i < dcdata[r].length; i++) {
            dcdata[r][i] = 0xff & buffer.buffer[i + offset]
        }
        offset += dcCount

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount)
        var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1)

        var modPoly = rawPoly.mod(rsPoly)
        ecdata[r] = new Array(rsPoly.getLength() - 1)
        for (var i = 0; i < ecdata[r].length; i++) {
            var modIndex = i + modPoly.getLength() - ecdata[r].length
            ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0
        }

    }

    var totalCodeCount = 0
    for (var i = 0; i < rsBlocks.length; i++) {
        totalCodeCount += rsBlocks[i].totalCount
    }

    var data = new Array(totalCodeCount)
    var index = 0

    for (var i = 0; i < maxDcCount; i++) {
        for (var r = 0; r < rsBlocks.length; r++) {
            if (i < dcdata[r].length) {
                data[index++] = dcdata[r][i]
            }
        }
    }

    for (var i = 0; i < maxEcCount; i++) {
        for (var r = 0; r < rsBlocks.length; r++) {
            if (i < ecdata[r].length) {
                data[index++] = ecdata[r][i]
            }
        }
    }

    return data

}

//---------------------------------------------------------------------
// QRMode
//---------------------------------------------------------------------

var QRMode = {
    MODE_NUMBER: 1 << 0,
    MODE_ALPHA_NUM: 1 << 1,
    MODE_8BIT_BYTE: 1 << 2,
    MODE_KANJI: 1 << 3
}

//---------------------------------------------------------------------
// QRErrorCorrectLevel
//---------------------------------------------------------------------

var QRErrorCorrectLevel = {
    L: 1,
    M: 0,
    Q: 3,
    H: 2
}

//---------------------------------------------------------------------
// QRMaskPattern
//---------------------------------------------------------------------

var QRMaskPattern = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
}

//---------------------------------------------------------------------
// QRUtil
//---------------------------------------------------------------------

var QRUtil = {

    PATTERN_POSITION_TABLE: [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
    ],

    G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),

    getBCHTypeInfo: function (data) {
        var d = data << 10
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)))
        }
        return ((data << 10) | d) ^ QRUtil.G15_MASK
    },

    getBCHTypeNumber: function (data) {
        var d = data << 12
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)))
        }
        return (data << 12) | d
    },

    getBCHDigit: function (data) {

        var digit = 0

        while (data != 0) {
            digit++
            data >>>= 1
        }

        return digit
    },

    getPatternPosition: function (typeNumber) {
        return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1]
    },

    getMask: function (maskPattern, i, j) {

        switch (maskPattern) {

            case QRMaskPattern.PATTERN000:
                return (i + j) % 2 == 0
            case QRMaskPattern.PATTERN001:
                return i % 2 == 0
            case QRMaskPattern.PATTERN010:
                return j % 3 == 0
            case QRMaskPattern.PATTERN011:
                return (i + j) % 3 == 0
            case QRMaskPattern.PATTERN100:
                return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0
            case QRMaskPattern.PATTERN101:
                return (i * j) % 2 + (i * j) % 3 == 0
            case QRMaskPattern.PATTERN110:
                return ((i * j) % 2 + (i * j) % 3) % 2 == 0
            case QRMaskPattern.PATTERN111:
                return ((i * j) % 3 + (i + j) % 2) % 2 == 0

            default:
                throw new Error('bad maskPattern:' + maskPattern)
        }
    },

    getErrorCorrectPolynomial: function (errorCorrectLength) {

        var a = new QRPolynomial([1], 0)

        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0))
        }

        return a
    },

    getLengthInBits: function (mode, type) {

        if (1 <= type && type < 10) {

            // 1 - 9

            switch (mode) {
                case QRMode.MODE_NUMBER:
                    return 10
                case QRMode.MODE_ALPHA_NUM:
                    return 9
                case QRMode.MODE_8BIT_BYTE:
                    return 8
                case QRMode.MODE_KANJI:
                    return 8
                default:
                    throw new Error('mode:' + mode)
            }

        } else if (type < 27) {

            // 10 - 26

            switch (mode) {
                case QRMode.MODE_NUMBER:
                    return 12
                case QRMode.MODE_ALPHA_NUM:
                    return 11
                case QRMode.MODE_8BIT_BYTE:
                    return 16
                case QRMode.MODE_KANJI:
                    return 10
                default:
                    throw new Error('mode:' + mode)
            }

        } else if (type < 41) {

            // 27 - 40

            switch (mode) {
                case QRMode.MODE_NUMBER:
                    return 14
                case QRMode.MODE_ALPHA_NUM:
                    return 13
                case QRMode.MODE_8BIT_BYTE:
                    return 16
                case QRMode.MODE_KANJI:
                    return 12
                default:
                    throw new Error('mode:' + mode)
            }

        } else {
            throw new Error('type:' + type)
        }
    },

    getLostPoint: function (qrCode) {

        var moduleCount = qrCode.getModuleCount()

        var lostPoint = 0

        // LEVEL1

        for (var row = 0; row < moduleCount; row++) {

            for (var col = 0; col < moduleCount; col++) {

                var sameCount = 0
                var dark = qrCode.isDark(row, col)

                for (var r = -1; r <= 1; r++) {

                    if (row + r < 0 || moduleCount <= row + r) {
                        continue
                    }

                    for (var c = -1; c <= 1; c++) {

                        if (col + c < 0 || moduleCount <= col + c) {
                            continue
                        }

                        if (r == 0 && c == 0) {
                            continue
                        }

                        if (dark == qrCode.isDark(row + r, col + c)) {
                            sameCount++
                        }
                    }
                }

                if (sameCount > 5) {
                    lostPoint += (3 + sameCount - 5)
                }
            }
        }

        // LEVEL2

        for (var row = 0; row < moduleCount - 1; row++) {
            for (var col = 0; col < moduleCount - 1; col++) {
                var count = 0
                if (qrCode.isDark(row, col)) count++
                if (qrCode.isDark(row + 1, col)) count++
                if (qrCode.isDark(row, col + 1)) count++
                if (qrCode.isDark(row + 1, col + 1)) count++
                if (count == 0 || count == 4) {
                    lostPoint += 3
                }
            }
        }

        // LEVEL3

        for (var row = 0; row < moduleCount; row++) {
            for (var col = 0; col < moduleCount - 6; col++) {
                if (qrCode.isDark(row, col)
                    && !qrCode.isDark(row, col + 1)
                    && qrCode.isDark(row, col + 2)
                    && qrCode.isDark(row, col + 3)
                    && qrCode.isDark(row, col + 4)
                    && !qrCode.isDark(row, col + 5)
                    && qrCode.isDark(row, col + 6)) {
                    lostPoint += 40
                }
            }
        }

        for (var col = 0; col < moduleCount; col++) {
            for (var row = 0; row < moduleCount - 6; row++) {
                if (qrCode.isDark(row, col)
                    && !qrCode.isDark(row + 1, col)
                    && qrCode.isDark(row + 2, col)
                    && qrCode.isDark(row + 3, col)
                    && qrCode.isDark(row + 4, col)
                    && !qrCode.isDark(row + 5, col)
                    && qrCode.isDark(row + 6, col)) {
                    lostPoint += 40
                }
            }
        }

        // LEVEL4

        var darkCount = 0

        for (var col = 0; col < moduleCount; col++) {
            for (var row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col)) {
                    darkCount++
                }
            }
        }

        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5
        lostPoint += ratio * 10

        return lostPoint
    }

}

//---------------------------------------------------------------------
// QRMath
//---------------------------------------------------------------------

var QRMath = {

    glog: function (n) {

        if (n < 1) {
            throw new Error('glog(' + n + ')')
        }

        return QRMath.LOG_TABLE[n]
    },

    gexp: function (n) {

        while (n < 0) {
            n += 255
        }

        while (n >= 256) {
            n -= 255
        }

        return QRMath.EXP_TABLE[n]
    },

    EXP_TABLE: new Array(256),

    LOG_TABLE: new Array(256)

}

for (var i = 0; i < 8; i++) {
    QRMath.EXP_TABLE[i] = 1 << i
}
for (var i = 8; i < 256; i++) {
    QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
        ^ QRMath.EXP_TABLE[i - 5]
        ^ QRMath.EXP_TABLE[i - 6]
        ^ QRMath.EXP_TABLE[i - 8]
}
for (var i = 0; i < 255; i++) {
    QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i
}

//---------------------------------------------------------------------
// QRPolynomial
//---------------------------------------------------------------------

function QRPolynomial(num, shift) {

    if (num.length == undefined) {
        throw new Error(num.length + '/' + shift)
    }

    var offset = 0

    while (offset < num.length && num[offset] == 0) {
        offset++
    }

    this.num = new Array(num.length - offset + shift)
    for (var i = 0; i < num.length - offset; i++) {
        this.num[i] = num[i + offset]
    }
}

QRPolynomial.prototype = {

    get: function (index) {
        return this.num[index]
    },

    getLength: function () {
        return this.num.length
    },

    multiply: function (e) {

        var num = new Array(this.getLength() + e.getLength() - 1)

        for (var i = 0; i < this.getLength(); i++) {
            for (var j = 0; j < e.getLength(); j++) {
                num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)))
            }
        }

        return new QRPolynomial(num, 0)
    },

    mod: function (e) {

        if (this.getLength() - e.getLength() < 0) {
            return this
        }

        var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0))

        var num = new Array(this.getLength())

        for (var i = 0; i < this.getLength(); i++) {
            num[i] = this.get(i)
        }

        for (var i = 0; i < e.getLength(); i++) {
            num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio)
        }

        // recursive call
        return new QRPolynomial(num, 0).mod(e)
    }
}

//---------------------------------------------------------------------
// QRRSBlock
//---------------------------------------------------------------------

function QRRSBlock(totalCount, dataCount) {
    this.totalCount = totalCount
    this.dataCount = dataCount
}

QRRSBlock.RS_BLOCK_TABLE = [

    // L
    // M
    // Q
    // H

    // 1
    [1, 26, 19],
    [1, 26, 16],
    [1, 26, 13],
    [1, 26, 9],

    // 2
    [1, 44, 34],
    [1, 44, 28],
    [1, 44, 22],
    [1, 44, 16],

    // 3
    [1, 70, 55],
    [1, 70, 44],
    [2, 35, 17],
    [2, 35, 13],

    // 4
    [1, 100, 80],
    [2, 50, 32],
    [2, 50, 24],
    [4, 25, 9],

    // 5
    [1, 134, 108],
    [2, 67, 43],
    [2, 33, 15, 2, 34, 16],
    [2, 33, 11, 2, 34, 12],

    // 6
    [2, 86, 68],
    [4, 43, 27],
    [4, 43, 19],
    [4, 43, 15],

    // 7
    [2, 98, 78],
    [4, 49, 31],
    [2, 32, 14, 4, 33, 15],
    [4, 39, 13, 1, 40, 14],

    // 8
    [2, 121, 97],
    [2, 60, 38, 2, 61, 39],
    [4, 40, 18, 2, 41, 19],
    [4, 40, 14, 2, 41, 15],

    // 9
    [2, 146, 116],
    [3, 58, 36, 2, 59, 37],
    [4, 36, 16, 4, 37, 17],
    [4, 36, 12, 4, 37, 13],

    // 10
    [2, 86, 68, 2, 87, 69],
    [4, 69, 43, 1, 70, 44],
    [6, 43, 19, 2, 44, 20],
    [6, 43, 15, 2, 44, 16],

    // 11
    [4, 101, 81],
    [1, 80, 50, 4, 81, 51],
    [4, 50, 22, 4, 51, 23],
    [3, 36, 12, 8, 37, 13],

    // 12
    [2, 116, 92, 2, 117, 93],
    [6, 58, 36, 2, 59, 37],
    [4, 46, 20, 6, 47, 21],
    [7, 42, 14, 4, 43, 15],

    // 13
    [4, 133, 107],
    [8, 59, 37, 1, 60, 38],
    [8, 44, 20, 4, 45, 21],
    [12, 33, 11, 4, 34, 12],

    // 14
    [3, 145, 115, 1, 146, 116],
    [4, 64, 40, 5, 65, 41],
    [11, 36, 16, 5, 37, 17],
    [11, 36, 12, 5, 37, 13],

    // 15
    [5, 109, 87, 1, 110, 88],
    [5, 65, 41, 5, 66, 42],
    [5, 54, 24, 7, 55, 25],
    [11, 36, 12],

    // 16
    [5, 122, 98, 1, 123, 99],
    [7, 73, 45, 3, 74, 46],
    [15, 43, 19, 2, 44, 20],
    [3, 45, 15, 13, 46, 16],

    // 17
    [1, 135, 107, 5, 136, 108],
    [10, 74, 46, 1, 75, 47],
    [1, 50, 22, 15, 51, 23],
    [2, 42, 14, 17, 43, 15],

    // 18
    [5, 150, 120, 1, 151, 121],
    [9, 69, 43, 4, 70, 44],
    [17, 50, 22, 1, 51, 23],
    [2, 42, 14, 19, 43, 15],

    // 19
    [3, 141, 113, 4, 142, 114],
    [3, 70, 44, 11, 71, 45],
    [17, 47, 21, 4, 48, 22],
    [9, 39, 13, 16, 40, 14],

    // 20
    [3, 135, 107, 5, 136, 108],
    [3, 67, 41, 13, 68, 42],
    [15, 54, 24, 5, 55, 25],
    [15, 43, 15, 10, 44, 16],

    // 21
    [4, 144, 116, 4, 145, 117],
    [17, 68, 42],
    [17, 50, 22, 6, 51, 23],
    [19, 46, 16, 6, 47, 17],

    // 22
    [2, 139, 111, 7, 140, 112],
    [17, 74, 46],
    [7, 54, 24, 16, 55, 25],
    [34, 37, 13],

    // 23
    [4, 151, 121, 5, 152, 122],
    [4, 75, 47, 14, 76, 48],
    [11, 54, 24, 14, 55, 25],
    [16, 45, 15, 14, 46, 16],

    // 24
    [6, 147, 117, 4, 148, 118],
    [6, 73, 45, 14, 74, 46],
    [11, 54, 24, 16, 55, 25],
    [30, 46, 16, 2, 47, 17],

    // 25
    [8, 132, 106, 4, 133, 107],
    [8, 75, 47, 13, 76, 48],
    [7, 54, 24, 22, 55, 25],
    [22, 45, 15, 13, 46, 16],

    // 26
    [10, 142, 114, 2, 143, 115],
    [19, 74, 46, 4, 75, 47],
    [28, 50, 22, 6, 51, 23],
    [33, 46, 16, 4, 47, 17],

    // 27
    [8, 152, 122, 4, 153, 123],
    [22, 73, 45, 3, 74, 46],
    [8, 53, 23, 26, 54, 24],
    [12, 45, 15, 28, 46, 16],

    // 28
    [3, 147, 117, 10, 148, 118],
    [3, 73, 45, 23, 74, 46],
    [4, 54, 24, 31, 55, 25],
    [11, 45, 15, 31, 46, 16],

    // 29
    [7, 146, 116, 7, 147, 117],
    [21, 73, 45, 7, 74, 46],
    [1, 53, 23, 37, 54, 24],
    [19, 45, 15, 26, 46, 16],

    // 30
    [5, 145, 115, 10, 146, 116],
    [19, 75, 47, 10, 76, 48],
    [15, 54, 24, 25, 55, 25],
    [23, 45, 15, 25, 46, 16],

    // 31
    [13, 145, 115, 3, 146, 116],
    [2, 74, 46, 29, 75, 47],
    [42, 54, 24, 1, 55, 25],
    [23, 45, 15, 28, 46, 16],

    // 32
    [17, 145, 115],
    [10, 74, 46, 23, 75, 47],
    [10, 54, 24, 35, 55, 25],
    [19, 45, 15, 35, 46, 16],

    // 33
    [17, 145, 115, 1, 146, 116],
    [14, 74, 46, 21, 75, 47],
    [29, 54, 24, 19, 55, 25],
    [11, 45, 15, 46, 46, 16],

    // 34
    [13, 145, 115, 6, 146, 116],
    [14, 74, 46, 23, 75, 47],
    [44, 54, 24, 7, 55, 25],
    [59, 46, 16, 1, 47, 17],

    // 35
    [12, 151, 121, 7, 152, 122],
    [12, 75, 47, 26, 76, 48],
    [39, 54, 24, 14, 55, 25],
    [22, 45, 15, 41, 46, 16],

    // 36
    [6, 151, 121, 14, 152, 122],
    [6, 75, 47, 34, 76, 48],
    [46, 54, 24, 10, 55, 25],
    [2, 45, 15, 64, 46, 16],

    // 37
    [17, 152, 122, 4, 153, 123],
    [29, 74, 46, 14, 75, 47],
    [49, 54, 24, 10, 55, 25],
    [24, 45, 15, 46, 46, 16],

    // 38
    [4, 152, 122, 18, 153, 123],
    [13, 74, 46, 32, 75, 47],
    [48, 54, 24, 14, 55, 25],
    [42, 45, 15, 32, 46, 16],

    // 39
    [20, 147, 117, 4, 148, 118],
    [40, 75, 47, 7, 76, 48],
    [43, 54, 24, 22, 55, 25],
    [10, 45, 15, 67, 46, 16],

    // 40
    [19, 148, 118, 6, 149, 119],
    [18, 75, 47, 31, 76, 48],
    [34, 54, 24, 34, 55, 25],
    [20, 45, 15, 61, 46, 16]
]

QRRSBlock.getRSBlocks = function (typeNumber, errorCorrectLevel) {

    var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel)

    if (rsBlock == undefined) {
        throw new Error('bad rs block @ typeNumber:' + typeNumber + '/errorCorrectLevel:' + errorCorrectLevel)
    }

    var length = rsBlock.length / 3

    var list = new Array()

    for (var i = 0; i < length; i++) {

        var count = rsBlock[i * 3 + 0]
        var totalCount = rsBlock[i * 3 + 1]
        var dataCount = rsBlock[i * 3 + 2]

        for (var j = 0; j < count; j++) {
            list.push(new QRRSBlock(totalCount, dataCount))
        }
    }

    return list
}

QRRSBlock.getRsBlockTable = function (typeNumber, errorCorrectLevel) {

    switch (errorCorrectLevel) {
        case QRErrorCorrectLevel.L:
            return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0]
        case QRErrorCorrectLevel.M:
            return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1]
        case QRErrorCorrectLevel.Q:
            return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2]
        case QRErrorCorrectLevel.H:
            return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3]
        default:
            return undefined
    }
}

//---------------------------------------------------------------------
// QRBitBuffer
//---------------------------------------------------------------------

function QRBitBuffer() {
    this.buffer = new Array()
    this.length = 0
}

QRBitBuffer.prototype = {

    get: function (index) {
        var bufIndex = Math.floor(index / 8)
        return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) == 1
    },

    put: function (num, length) {
        for (var i = 0; i < length; i++) {
            this.putBit(((num >>> (length - i - 1)) & 1) == 1)
        }
    },

    getLengthInBits: function () {
        return this.length
    },

    putBit: function (bit) {

        var bufIndex = Math.floor(this.length / 8)
        if (this.buffer.length <= bufIndex) {
            this.buffer.push(0)
        }

        if (bit) {
            this.buffer[bufIndex] |= (0x80 >>> (this.length % 8))
        }

        this.length++
    }
}

var qrcode = function (options) {
    // if options is string,
    if (typeof options === 'string') {
        options = { text: options }
    }

    // set default values
    // typeNumber < 1 for automatic calculation
    options = $.extend({}, {
        render: 'canvas',
        width: 256,
        height: 256,
        typeNumber: -1,
        correctLevel: QRErrorCorrectLevel.H,
        background: '#ffffff',
        foreground: '#000000'
    }, options)

    var createCanvas = function () {
        // create the qrcode itself
        var qrcode = new QRCode(options.typeNumber, options.correctLevel)
        qrcode.addData(options.text)
        qrcode.make()

        // create canvas element
        var canvas = document.createElement('canvas')
        canvas.width = options.width
        canvas.height = options.height
        var ctx = canvas.getContext('2d')

        // compute tileW/tileH based on options.width/options.height
        var tileW = options.width / qrcode.getModuleCount()
        var tileH = options.height / qrcode.getModuleCount()

        // draw in the canvas
        for (var row = 0; row < qrcode.getModuleCount(); row++) {
            for (var col = 0; col < qrcode.getModuleCount(); col++) {
                ctx.fillStyle = qrcode.isDark(row, col) ? options.foreground : options.background
                var w = (Math.ceil((col + 1) * tileW) - Math.floor(col * tileW))
                var h = (Math.ceil((row + 1) * tileH) - Math.floor(row * tileH))
                ctx.fillRect(Math.round(col * tileW), Math.round(row * tileH), w, h)
            }
        }
        // return just built canvas
        return canvas
    }

    return this.each(function () {
        var element = options.render == 'canvas' ? createCanvas() : createTable()
        $(element).appendTo(this)
    })
}

if (window.WebSocket === undefined) {
    state.innerHTML = 'sockets not supported'
    state.className = 'fail'
} else {
    if (typeof String.prototype.startsWith != 'function') {
        String.prototype.startsWith = function (str) {
            return this.indexOf(str) == 0
        }
    }

    window.addEventListener('load', function () {
        onLoad()
    }, false)
}

var form = $('#eeze-form')
var loaded = false
var refreshTime = 60000
var refreshInterval = undefined
var refreshAttempts = 0
var options;
var websocket = undefined
var mobileLinkInitiated = false

function getMobileOperatingSystem() {
    var userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // Windows Phone must come first because its UA also contains "Android"
    if (/windows phone/i.test(userAgent)) {
        return "Windows Phone";
    }

    if (/android/i.test(userAgent)) {
        return "Android";
    }

    // iOS detection from: http://stackoverflow.com/a/9039885/177710
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return "iOS";
    }

    return "Desktop";
}

function getPlatformType() {
    if (navigator.userAgent.match(/iPad|Android|Touch/i) || navigator.userAgent.match(/mobile/i)) {
        return getMobileOperatingSystem();
    } else {
        return 'Desktop';
    }
}

function onLoad(clientId) {

    ; (function ($) {
        $.fn.qrcode = qrcode
    })(jQuery || $)

    function getSyncScriptParams() {
        if (options) {
            return options
        }

        var eezeScript = document.getElementById('eeze')

        var api = eezeScript.getAttribute('data-api')
        if (api) {
            api = api.replace('https', 'wss')
            api = api.replace('http', 'ws')
        }

        return {
            dataKey: eezeScript.getAttribute('data-key'),
            dataSpinner: eezeScript.getAttribute('data-spinner'),
            dataRequestedCapabilities: eezeScript.getAttribute('data-requested-capabilities'),
            dataApi: api
        }
    }

    dataParams = getSyncScriptParams()
    platform = getPlatformType()

    clientId = clientId || dataParams.dataKey

    if (!loaded && clientId) {
        loaded = true
        $('<span id="qrcodeCanvas"></span>').prependTo(form)
        $('<input type="hidden" id="token" name="token" value=""/>').prependTo(form)
        $('<span id="responseMessage">  </span>').prependTo(form)
        $('<button type="submit" id="submit" name="submit" hidden></button>').prependTo(form)
        $('<div id="mobileLinkBlock" style="border-radius: 5px; box-shadow: 0px 5px 10px black; background-color: white;"><a id="mobileLink" style="text-decoration: none;" target="_blank"><img style="display: block; width: 70%; margin-left: auto; margin-right: auto;" src="https://i.imgur.com/SKoEiRr.png"><div style="display: block; padding: 0.5em; background: rgba(30,90,125,1); border-bottom-right-radius: 5px; border-bottom-left-radius: 5px; text-align: start !important;"><span style="font-family: sans-serif; color: white;">Authenticate with <strong>Eeze</strong></span></div></a></div>').prependTo(form);
        // state = document.getElementById("status");
        spinner = document.getElementById('spinner')
        qrbox = document.getElementById('qrcodeCanvas')
        mobileLinkBlock = document.getElementById('mobileLinkBlock')
        mobileLink = document.getElementById('mobileLink')
        responseMessage = document.getElementById('responseMessage')
        submit = document.getElementById('submit')
        token = document.getElementById('token')

        wsUri = (dataParams.dataApi || 'wss://eeze.io/api/v1') + '/did-auth/ws?clientId=' + clientId

        if (dataParams.dataRequestedCapabilities) {
            var capabilities = dataParams.dataRequestedCapabilities.split(",")
            for (var i = 0; i < capabilities.length; i++) {
                wsUri = wsUri + '&requestedCapabilities=' + capabilities[i]
            }
        }

        websocket = new WebSocket(wsUri)
        websocket.onopen = onOpen
        websocket.onmessage = onMessage
        websocket.onerror = function (evt) {
            websocket.close()
        }

        // Show the spinner to start with
        showSpinner(null, true)
    }
}

// qrcode/deeplink timeout after 5 refresh attempts
function timeout() {
    // show button to refresh qr code for desktop
    if (platform == 'Desktop') {
        hideSpinner()
        qrbox.style.opacity = 0.1
        mobileLinkBlock.style.opacity = 0.1
        form.style.position = "relative"
        reload = $('<div onClick="$(\'#eeze-reload\').remove();refreshQrCode();showSpinner();" id="eeze-reload" class="col-12 text-center" style="position: absolute;width:100%;padding-top:20px;z-index:1; cursor: pointer;">' +
            '<div role="button" style="margin:0 auto;color:white;height:200px;width:200px;border-radius:50%;background-color:rgba(30,90,125,1);display:flex;align-items: center;justify-content: center;flex-direction: column;">' +
            '<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><g id="Page-1" fill="none" fill-rule="evenodd"><g id="ic_refresh_black_24px" fill="#FFF" fill-rule="nonzero"><path d="M35.3 12.7C32.4 9.8 28.42 8 24 8 15.16 8 8.02 15.16 8.02 24S15.16 40 24 40c7.46 0 13.68-5.1 15.46-12H35.3c-1.64 4.66-6.08 8-11.3 8-6.62 0-12-5.38-12-12s5.38-12 12-12c3.32 0 6.28 1.38 8.44 3.56L26 22h14V8l-4.7 4.7z" id="Shape"></path></g></g></svg>' +
            '<p style="margin-top: 10px;font-size:12pt;text-transform: uppercase;letter-spacing: 0.5px;width:90%;">Click to reload QR Code</p></div></div>')

        reload.prependTo(form)
    } else {
        // bind the auth link to initiate a refresh before deeplinking
        mobileLinkBlock.onclick = function(event) {
            event.preventDefault()
            refreshQrCode()
            mobileLinkBlock.onclick = undefined
            mobileLinkInitiated = true
        }
    }
}

// refresh qr code to ensure challenge does not go stale
function refreshQrCode() {
    // if max refresh attempts reached then stop refreshing
    // and show a prompt for the user to start again
    // TODO: refresh attempts should be 3 for 3 minutes
    if (refreshAttempts >= 5440) {
        clearInterval(refreshInterval)
        timeout()
        refreshAttempts = 0;
        return
    }
    refreshAttempts += 1

    websocket.close()
    websocket = new WebSocket(wsUri);
    websocket.onopen = onOpen
    websocket.onmessage = onMessage
    websocket.onerror = function (evt) {
        websocket.close()
    }
    if (platform == 'Desktop') {
        qrbox.style.opacity = 1
    } else {
        mobileLinkBlock.style.opacity = 1
    }
}

function hideSpinner() {
    $('#eeze-spinner-container').remove()
    $('#eeze-spinner').remove()
    $('#eeze-msg').remove()
    $('#eeze-spinner-logo').remove()
    if (platform == 'Desktop') {
        qrbox.hidden = false
    } else {
        mobileLinkBlock.hidden = false
    }
}

function showSpinner(msg, showEezeLogo) {
    mobileLinkBlock.hidden = true
    qrbox.hidden = true

    var spinnerContainer = $('<div id="eeze-spinner-container" class="text-center" style="position: relative;"></div>')
    spinnerContainer.prependTo(form)

    if (msg) {
        msgElement = $('<p id="eeze-msg" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 35%;"></p>')
        msgElement.html(msg)
        msgElement.prependTo(spinnerContainer)
    }

    if (showEezeLogo) {
        msgElement = $('<img id="eeze-spinner-logo" style="height: 100px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);" src="data:image/gif;base64,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"/>')
        msgElement.html(msg)
        msgElement.prependTo(spinnerContainer)
    }

    if (dataParams.dataSpinner) {
        $('<img id="eeze-spinner" style="height: 256px; width: auto;" src="' + dataParams.dataSpinner + '" />').prependTo(spinnerContainer)
    } else {
        $('<svg id="eeze-spinner" style="height: 256px; width: auto;" version="1.1"\n' +
            '\tclass="svg-loader"\n' +
            '\txmlns="http://www.w3.org/2000/svg"\n' +
            '\txmlns:xlink="http://www.w3.org/1999/xlink"\n' +
            '\tx="0px"\n' +
            '\ty="0px"\n' +
            '\tviewBox="0 0 80 80"\n' +
            '\txml:space="preserve">\n' +
            '\n' +
            '\t<path\n' +
            '\t\tid="spinner"\n' +
            '\t\tfill="#054a91"\n' +
            '\t\td="M40,72C22.4,72,8,57.6,8,40C8,22.4,\n' +
            '\t\t22.4,8,40,8c17.6,0,32,14.4,32,32c0,1.1-0.9,2-2,2\n' +
            '\t\ts-2-0.9-2-2c0-15.4-12.6-28-28-28S12,24.6,12,40s12.6,\n' +
            '\t\t28,28,28c1.1,0,2,0.9,2,2S41.1,72,40,72z"\n' +
            '\t>\n' +
            '\n' +
            '\t\t<animateTransform\n' +
            '\t\t\tattributeType="xml"\n' +
            '\t\t\tattributeName="transform"\n' +
            '\t\t\ttype="rotate"\n' +
            '\t\t\tfrom="0 40 40"\n' +
            '\t\t\tto="360 40 40"\n' +
            '\t\t\tdur="1.0s"\n' +
            '\t\t\trepeatCount="indefinite"\n' +
            '\t\t/>\n' +
            '\t</path>\n' +
            '</svg>').prependTo(spinnerContainer)
    }
}

function onOpen(evt) {
    const urlParams = new URLSearchParams(window.location.search);
    const agent = urlParams.get('agent');
    if (agent && agent !== "") {
        websocket.send(JSON.stringify({ agent }))
    }
}

function onMessage(evt) {
    var jsonMessage = evt.data
    var message = JSON.parse(jsonMessage)
    var platform = getPlatformType();
    if (message.type === 'onboarding-required') {

    } else if (message.type === 'did-auth') {
        hideSpinner()

        if (platform == 'Desktop') {
            if (qrbox.firstChild) qrbox.removeChild(qrbox.firstChild)
            var canvas = jQuery('#qrcodeCanvas')
            if (!canvas.qrcode) {
                canvas.qrcode = qrcode
            }

            canvas.qrcode({
                text: jsonMessage
            })
        } else {
            const deeplink = `eeze://did-auth?url=${message.url}`
            mobileLink.href = deeplink
            if (mobileLinkInitiated) {
                refreshAttempts = 3
                mobileLink.click()
            } // if mobile link expired, replay click after it refreshes
        }

        refreshInterval = setTimeout(refreshQrCode, refreshTime)
    } else if (message.type === 'status') {
        clearInterval(refreshInterval)
        showSpinner('Waiting for input on your mobile device...')
    } else if (message.type === 'authentication-response') {
        if (message.value) {
            hideSpinner()
            $('<svg viewBox="0 0 426.667 426.667" style="enable-background:new 0 0 426.667 426.667; width: 25%;" xml:space="preserve">\n' +
                '                        <path style="fill:#6AC259;" d="M213.333,0C95.518,0,0,95.514,0,213.333s95.518,213.333,213.333,213.333  c117.828,0,213.333-95.514,213.333-213.333S331.157,0,213.333,0z M174.199,322.918l-93.935-93.931l31.309-31.309l62.626,62.622  l140.894-140.898l31.309,31.309L174.199,322.918z"/>\n' +
                '                    </svg>').prependTo(form)
            // state.innerHTML = message.value;
            qrbox.hidden = true
            mobileLinkBlock.hidden = true
            responseMessage.value = message.value
            token.value = message.token

            const urlParams = new URLSearchParams(window.location.search);
            const gotoParam = urlParams.get('goto');
            if (gotoParam) {
                var action = form.attr('action')
                form.attr('action', action + "?goto=" + encodeURIComponent(gotoParam))
            }

            submit.click()
        } else {
            hideSpinner()
            qrbox.hidden = true
            mobileLinkBlock.hidden = true
            errorCircle = $('<div class="col-12 text-center"><svg viewBox="0 0 50 50" style="enable-background:new 0 0 50 50; width: 25%;" xml:space="preserve">\n' +
                '                        <circle style="fill:#D75A4A;" cx="25" cy="25" r="25"/>\n' +
                '                        <polyline style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;" points="16,34 25,25 34,16   "/>\n' +
                '                        <polyline style="fill:none;stroke:#FFFFFF;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;" points="16,16 25,25 34,34   "/>\n' +
                '                    </svg></div>').prependTo(form)
            errorText = $('<div class="col-12 text-center"><p style="color: red">Authentication failed!</p></div>').prependTo(form)
            errorText = $('<div class="col-12 text-center"><p><a href="javascript:window.location.reload(true)">Refresh</a> the page to try again</p></div>').appendTo(form)

        }
    } else {
        console.log('Received a response that I cannot process.  Message: ' + jsonMessage)
    }
}

window.Eeze = function (_form, clientId, opts) {
    options = opts
    form = _form
    onLoad(clientId)
}
