var base58check = require('bs58check')
var bcrypto = require('./crypto')
var createHmac = require('create-hmac')
var typeforce = require('typeforce')
var types = require('./types')
var NETWORKS = require('./networks')

var BigInteger = require('bigi')
var ECPair = require('./ecpair')

var ecurve = require('ecurve')
var curve = ecurve.getCurveByName('secp256k1')

/**
 * @constructor
 * @param {ECPair} keyPair
 * @param {Buffer} chainCode
 */
function HDNode (keyPair, chainCode) {
  typeforce(types.tuple('ECPair', types.Buffer256bit), arguments)

  if (!keyPair.compressed) throw new TypeError('BIP32 only allows compressed keyPairs')

  /** @type {ECPair} */ this.keyPair = keyPair
  /** @type {Buffer} */ this.chainCode = chainCode
  /** @type {number} */ this.depth = 0
  /** @type {number} */ this.index = 0
  /** @type {number} */ this.parentFingerprint = 0x00000000
}

HDNode.HIGHEST_BIT = 0x80000000
HDNode.LENGTH = 78
HDNode.MASTER_SECRET = new Buffer('Bitcoin seed')

/**
 * @param {string|Buffer} seed
 * @param {Network} [network]
 * @returns {HDNode}
 */
HDNode.fromSeedBuffer = function (seed, network) {
  typeforce(types.tuple(types.Buffer, types.maybe(types.Network)), arguments)

  if (seed.length < 16) throw new TypeError('Seed should be at least 128 bits')
  if (seed.length > 64) throw new TypeError('Seed should be at most 512 bits')

  var I = createHmac('sha512', HDNode.MASTER_SECRET).update(seed).digest()
  var IL = I.slice(0, 32)
  var IR = I.slice(32)

  // In case IL is 0 or >= n, the master key is invalid
  // This is handled by the ECPair constructor
  var pIL = BigInteger.fromBuffer(IL)
  var keyPair = new ECPair(pIL, null, {
    network: network
  })

  return new HDNode(keyPair, IR)
}

/**
 * @param {string} hex
 * @returns {HDNode}
 */
HDNode.fromSeedHex = function (hex, network) {
  return HDNode.fromSeedBuffer(new Buffer(hex, 'hex'), network)
}

/**
 * @param {Buffer|string} string
 * @returns {HDNode}
 */
HDNode.fromBase58 = function (string, networks) {
  var buffer = base58check.decode(string)
  if (buffer.length !== 78) throw new Error('Invalid buffer length')

  // 4 bytes: version bytes
  var version = buffer.readUInt32BE(0)
  var network

  // list of networks?
  if (Array.isArray(networks)) {
    network = networks.filter(function (network) {
      return version === network.bip32.private ||
             version === network.bip32.public
    }).pop()

    if (!network) throw new Error('Unknown network version')

  // otherwise, assume a network object (or default to slack)
  } else {
    network = networks || NETWORKS.slack
  }

  if (version !== network.bip32.private &&
    version !== network.bip32.public) throw new Error('Invalid network version')

  // 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 descendants, ...
  var depth = buffer[4]

  // 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
  var parentFingerprint = buffer.readUInt32BE(5)
  if (depth === 0) {
    if (parentFingerprint !== 0x00000000) throw new Error('Invalid parent fingerprint')
  }

  // 4 bytes: child number. This is the number i in xi = xpar/i, with xi the key being serialized.
  // This is encoded in MSB order. (0x00000000 if master key)
  var index = buffer.readUInt32BE(9)
  if (depth === 0 && index !== 0) throw new Error('Invalid index')

  // 32 bytes: the chain code
  var chainCode = buffer.slice(13, 45)
  var keyPair

  // 33 bytes: private key data (0x00 + k)
  if (version === network.bip32.private) {
    if (buffer.readUInt8(45) !== 0x00) throw new Error('Invalid private key')

    var d = BigInteger.fromBuffer(buffer.slice(46, 78))
    keyPair = new ECPair(d, null, { network: network })

  // 33 bytes: public key data (0x02 + X or 0x03 + X)
  } else {
    var Q = ecurve.Point.decodeFrom(curve, buffer.slice(45, 78))
    // Q.compressed is assumed, if somehow this assumption is broken, `new HDNode` will throw

    // Verify that the X coordinate in the public point corresponds to a point on the curve.
    // If not, the extended public key is invalid.
    curve.validate(Q)

    keyPair = new ECPair(null, Q, { network: network })
  }

  var hd = new HDNode(keyPair, chainCode)
  hd.depth = depth
  hd.index = index
  hd.parentFingerprint = parentFingerprint

  return hd
}

/**
 * @returns {string}
 */
HDNode.prototype.getAddress = function () {
  return this.keyPair.getAddress()
}

/**
 * @returns {Buffer}
 */
HDNode.prototype.getIdentifier = function () {
  return bcrypto.hash160(this.keyPair.getPublicKeyBuffer())
}

/**
 * @returns {Buffer}
 */
HDNode.prototype.getFingerprint = function () {
  return this.getIdentifier().slice(0, 4)
}

/**
 * @returns {Network}
 */
HDNode.prototype.getNetwork = function () {
  return this.keyPair.getNetwork()
}

/**
 * @returns {Buffer}
 */
HDNode.prototype.getPublicKeyBuffer = function () {
  return this.keyPair.getPublicKeyBuffer()
}

/**
 * @returns {HDNode}
 */
HDNode.prototype.neutered = function () {
  var neuteredKeyPair = new ECPair(null, this.keyPair.Q, {
    network: this.keyPair.network
  })

  var neutered = new HDNode(neuteredKeyPair, this.chainCode)
  neutered.depth = this.depth
  neutered.index = this.index
  neutered.parentFingerprint = this.parentFingerprint

  return neutered
}

/**
 * @param {Buffer} hash
 * @returns {ECSignature}
 */
HDNode.prototype.sign = function (hash) {
  return this.keyPair.sign(hash)
}

/**
 * @param {Buffer} hash
 * @returns {boolean}
 */
HDNode.prototype.verify = function (hash, signature) {
  return this.keyPair.verify(hash, signature)
}

/**
 * @returns {string}
 */
HDNode.prototype.toBase58 = function () {
  // Version
  var network = this.keyPair.network
  var version = (!this.isNeutered()) ? network.bip32.private : network.bip32.public
  var buffer = new Buffer(78)

  // 4 bytes: version bytes
  buffer.writeUInt32BE(version, 0)

  // 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 descendants, ....
  buffer.writeUInt8(this.depth, 4)

  // 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
  buffer.writeUInt32BE(this.parentFingerprint, 5)

  // 4 bytes: child number. This is the number i in xi = xpar/i, with xi the key being serialized.
  // This is encoded in big endian. (0x00000000 if master key)
  buffer.writeUInt32BE(this.index, 9)

  // 32 bytes: the chain code
  this.chainCode.copy(buffer, 13)

  // 33 bytes: the public key or private key data
  if (!this.isNeutered()) {
    // 0x00 + k for private keys
    buffer.writeUInt8(0, 45)
    this.keyPair.d.toBuffer(32).copy(buffer, 46)

  // 33 bytes: the public key
  } else {
    // X9.62 encoding for public keys
    this.keyPair.getPublicKeyBuffer().copy(buffer, 45)
  }

  return base58check.encode(buffer)
}

/**
 * https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#child-key-derivation-ckd-functions
 *
 * @param {number} index UInt32
 * @returns {HDNode}
 */
HDNode.prototype.derive = function (index) {
  typeforce(types.UInt32, index)

  var isHardened = index >= HDNode.HIGHEST_BIT
  var data = new Buffer(37)

  // Hardened child
  if (isHardened) {
    if (this.isNeutered()) throw new TypeError('Could not derive hardened child key')

    // data = 0x00 || ser256(kpar) || ser32(index)
    data[0] = 0x00
    this.keyPair.d.toBuffer(32).copy(data, 1)
    data.writeUInt32BE(index, 33)

  // Normal child
  } else {
    // data = serP(point(kpar)) || ser32(index)
    //      = serP(Kpar) || ser32(index)
    this.keyPair.getPublicKeyBuffer().copy(data, 0)
    data.writeUInt32BE(index, 33)
  }

  var I = createHmac('sha512', this.chainCode).update(data).digest()
  var IL = I.slice(0, 32)
  var IR = I.slice(32)

  var pIL = BigInteger.fromBuffer(IL)

  // In case parse256(IL) >= n, proceed with the next value for i
  if (pIL.compareTo(curve.n) >= 0) {
    return this.derive(index + 1)
  }

  // Private parent key -> private child key
  var derivedKeyPair
  if (!this.isNeutered()) {
    // ki = parse256(IL) + kpar (mod n)
    var ki = pIL.add(this.keyPair.d).mod(curve.n)

    // In case ki == 0, proceed with the next value for i
    if (ki.signum() === 0) {
      return this.derive(index + 1)
    }

    derivedKeyPair = new ECPair(ki, null, {
      network: this.keyPair.network
    })

  // Public parent key -> public child key
  } else {
    // Ki = point(parse256(IL)) + Kpar
    //    = G*IL + Kpar
    var Ki = curve.G.multiply(pIL).add(this.keyPair.Q)

    // In case Ki is the point at infinity, proceed with the next value for i
    if (curve.isInfinity(Ki)) {
      return this.derive(index + 1)
    }

    derivedKeyPair = new ECPair(null, Ki, {
      network: this.keyPair.network
    })
  }

  var hd = new HDNode(derivedKeyPair, IR)
  hd.depth = this.depth + 1
  hd.index = index
  hd.parentFingerprint = this.getFingerprint().readUInt32BE(0)

  return hd
}

/**
 * @param {number} index
 * @returns {HDNode}
 */
HDNode.prototype.deriveHardened = function (index) {
  typeforce(types.UInt31, index)

  // Only derives hardened private keys by default
  return this.derive(index + HDNode.HIGHEST_BIT)
}

/**
 * Private `===` not neutered.
 * Public `===` neutered.
 *
 * @returns {boolean}
 */
HDNode.prototype.isNeutered = function () {
  return !(this.keyPair.d)
}

/**
 * @param {string} path
 * @returns {HDNode}
 */
HDNode.prototype.derivePath = function (path) {
  typeforce(types.BIP32Path, path)

  var splitPath = path.split('/')
  if (splitPath[0] === 'm') {
    if (this.parentFingerprint) {
      throw new Error('Not a master node')
    }

    splitPath = splitPath.slice(1)
  }

  return splitPath.reduce(function (prevHd, indexStr) {
    var index
    if (indexStr.slice(-1) === "'") {
      index = parseInt(indexStr.slice(0, -1), 10)
      return prevHd.deriveHardened(index)
    } else {
      index = parseInt(indexStr, 10)
      return prevHd.derive(index)
    }
  }, this)
}


module.exports = HDNode
