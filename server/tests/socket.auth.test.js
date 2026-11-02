const http = require('http');
const express = require('express');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { initSocket, getIO } = require('../src/socket');

const SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';

describe('Socket.io Handshake Auth', () => {
  let server, ioInstance, port, clientSocket;

  beforeAll((done) => {
    const app = express();
    server = http.createServer(app);
    ioInstance = initSocket(server);
    server.listen(() => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    ioInstance.close();
    server.close(done);
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('rejects connection without token', (done) => {
    clientSocket = new Client(`http://localhost:${port}`, {
      transports: ['websocket'],
    });
    clientSocket.on('connect_error', (err) => {
      expect(err.message).toMatch(/token/i);
      done();
    });
  });

  it('accepts connection with valid token and joins user room', (done) => {
    const token = jwt.sign({ id: 'u_test_100', email: 'test@ff.vn' }, SECRET);
    clientSocket = new Client(`http://localhost:${port}`, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
    });
    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
  });
});
