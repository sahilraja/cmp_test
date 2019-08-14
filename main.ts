import * as app from "./app";

//  Port 
const PORT = process.env.PORT || 3000

//  app listen
app.listen( PORT, () => {
    console.log(`Listening on port ${PORT}`);
});