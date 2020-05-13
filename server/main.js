import fs from 'fs';
import http from 'http';
import url from 'url';

import SocketIO from 'socket.io';

import { mediaTypeFromFileExtension } from './mediaType.js';

let settings;
try {
    settings = fs.readFileSync('settings.txt', { encoding: 'utf-8' })
        .split('\n')
        .slice(0, 3)
        .map(l => l.trim());
    if (settings.length < 3 || !settings.every(l => l.length)) {
        throw new Error('Settings should contain three lines: host, port and video.');
    }
    settings = settings.slice(0, 3).map(l => l.trim());
} catch (e) {
    console.error('Loading settings failed.', e.message);
    process.exit();
}
const [host, port, video] = settings;

const redirects = {
    'static/socket.io.js': 'node_modules/socket.io-client/dist/socket.io.js'
};

const routes = {
    notFound: async function (params) {
        const { res } = params;
        res.writeHead(404, {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
        });
        res.write('Not Found');
        res.end();
    },
    static: async function (params) {
        const { res, path } = params;
        const filePath = path in redirects ? redirects[path] : path;
        const extension = path.substr(path.lastIndexOf('.') + 1);

        try {
            const stat = await fs.promises.stat(filePath);
            res.writeHead(200, {
                'Content-Length': stat.size,
                'Content-Type': mediaTypeFromFileExtension(extension),
                'Access-Control-Allow-Origin': '*',
            });
            fs.createReadStream(filePath).pipe(res);
        } catch (e) {
            routes.notFound(params);
        }
    }
};

routes[''] = async function (params) {
    const { res } = params;
    res.writeHead(200, {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
    });

    const body = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <title>Sync Video Player</title>
    <link href="static/main.css" rel="stylesheet" type="text/css">
</head>
<body>
    <video id="player" muted="muted" controls>
        <source src="http://${host}:${port}/video" type="video/mp4">
    </video>
    <div id="player-controls">
        <div id="skip-neg-btn" class="button">⏪</div>
        <div id="play-btn" class="button">▶️</div>
        <div id="skip-pos-btn" class="button">⏩</div>
    </div>
    <script src="static/socket.io.js"></script>
    <script src="static/main.js" type="module"></script>
</body>
</html>
    `.trim();

    res.write(body);
    res.end();
}

routes.video = async function (params) {
    const { res } = params;
    const stat = await fs.promises.stat(video);
    const fileSize = stat.size;
    const { range } = params.headers;

    if (range) { // client requested specific range
        // For example: 'bytes=1631715328-'
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1]
            ? parseInt(parts[1], 10)
            : fileSize - 1;
        const chunkSize = (end - start) + 1;
        // https://nodejs.org/api/fs.html#fs_fs_createreadstream_path_options
        const readStream = fs.createReadStream(video, { start, end });
        res.writeHead(206, { // HTTP/1.1 206 Partial Content
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4',
            'Access-Control-Allow-Origin': '*',
        });
        // https://nodejs.org/api/stream.html#stream_readable_pipe_destination_options
        readStream.pipe(res);
    } else { // client started streaming
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
            'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(video).pipe(res);
    }
};

const server = http.createServer(function (req, res) {
    // Use `true` for the second 'slashesDenoteHost' param, so that given //foo/bar,
    // the result would be { host: 'foo', pathname: '/bar' }
    // rather than { pathname: '//foo/bar' }.
    const parsedURL = url.parse(req.url, true);
    const query = parsedURL.query;
    let path = parsedURL.pathname;
    // Remove one or more leading or trailing slashes.
    path = path.replace(/^\/+|\/+$/g, '');

    const { headers } = req;
    let method = req.method.toLowerCase();

    req.on('data', () => { });
    req.on('end', function () { // won't be called if the 'data' one is not set up
        const route = path.startsWith('static')
            ? routes.static
            : typeof routes[path] === 'function'
                ? routes[path]
                : routes.notFound;
        const params = {
            path,
            query,
            headers,
            method,
            req,
            res
        };

        // console.log('Processed request:', params);

        route(params);
    });
});

const io = SocketIO(server);
io.on('connection', client => {
    client.on('seek', time => {
        // send to all clients except sender
        client.broadcast.emit('seek', time);
    });
    client.on('play', time => {
        client.broadcast.emit('play', time);
    });
    client.on('pause', time => {
        client.broadcast.emit('pause', time);
    });
});

server.listen(port);

console.log(`The server is running at http://${host}:${port}`);