import * as app from "./app";
import "./utils/role_management";
import { initializeSocket } from "./socket";
let http = require('http').Server(app);
initializeSocket(http)

//  Port 
const PORT = process.env.PORT || 3000

//  app listen
http.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});