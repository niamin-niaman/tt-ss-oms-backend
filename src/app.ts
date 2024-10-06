import express from "express"
import bodyParser from "body-parser";
import { PrismaClient } from "@prisma/client";


const app = express();
app.use(bodyParser.json())

const prisma = new PrismaClient()


app.get("/", async (req, res) => {

    console.log('good health , good life')

    const testDB = await prisma.test.findMany();

    console.log(testDB)

    res.json({
        "message": "OK !!",
        "db":testDB 
    })
    
})

app.listen(4300, () => {
    console.log("Server started at http://localhost:4300");
});