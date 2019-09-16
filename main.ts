import * as app from "./app";
import "./utils/role_management";

//  Port 
const PORT = process.env.PORT || 3000

//  app listen
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});