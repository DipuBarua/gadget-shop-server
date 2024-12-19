const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken")
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 4000;


//middleware
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://gadget-shop-client-green.vercel.app"
    ],
    optionsSuccessStatus: 200,
}
));
app.use(express.json());

// verify jwt 
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.send({ message: "No token" })
    }
    // console.log(authorization);
    const token = authorization.split(" ")[1]
    // console.log(token);

    jwt.verify(token, process.env.ACCESS_KEY_TOKEN, (err, decoded) => {
        if (err) {
            return res.send({ message: "Invalid token!" })
        }
        req.decoded = decoded;
        next();
    })
}

//verify seller
const verifySeller = async (req, res, next) => {
    const email = req.decoded.email;
    const query = { email: email };
    const user = await userCollection.findOne(query);
    if (user.role !== 'seller') {
        return res.send({ message: "Forbidden access" })
    }
    next();
}

//mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bm0qnz4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient 
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const userCollection = client.db("gadgetShop").collection("users");
const productCollection = client.db("gadgetShop").collection("products");

const dbConnect = async () => {
    try {
        client.connect();
        console.log('database connected successfully! !!');

        // get wishlist 
        app.get('/wishlist/:userId', verifyJWT, async (req, res) => {
            const userId = req.params.userId;
            const query = { _id: new ObjectId(String(userId)) };
            const user = await userCollection.findOne(query);

            if (!user) {
                return res.send({ message: 'user not found!' })
            }

            const wishlist = await productCollection.find(
                {
                    _id:
                        { $in: user.wishlist || [] }
                }
            ).toArray();
            // syntax--> { field: { $in: [<value1>, <value2>, ... <valueN> ] } }
            // The $in operator selects the documents where the value of a field(_id) equals any value in the specified ([wishlist]) array.

            res.send(wishlist);
        })


        // update wishlist to ADD in user collection.
        app.patch('/wishlist/add', async (req, res) => {
            const { userEmail, productId } = req.body;
            const result = await userCollection.updateOne(
                { email: userEmail },
                {
                    $addToSet: {
                        wishlist: new ObjectId(String(productId))
                    }
                }
            )
            // The $addToSet --> operator adds a value to an array unless the value is already present, in which case $addToSet does nothing to that array.(it means same value doesn't add repeatedly just add for one time.)

            res.send(result);
        })


        // update wishlist to REMOVE from user collection.
        app.patch('/wishlist/remove', async (req, res) => {
            const { userEmail, productId } = req.body;
            const result = await userCollection.updateOne(
                { email: userEmail },
                {
                    $pull: {
                        wishlist: new ObjectId(String(productId))
                    }
                }
            )
            // The $pull --> operator removes from an existing array all instances of a value or values that match a specified condition.

            res.send(result);
        })


        // get products 
        app.get('/all-porducts', async (req, res) => {

            // To-Do list >>>>>
            // >> title searching
            // >> sorted by price
            // >> filter by category
            // >> filter by brand

            const { title, sort, category, brand, page, limit } = req.query;

            const query = {};

            if (title) {
                query.title = { $regex: title, $options: "i" };
                // $regex - Provides regular expression capabilities for pattern matching strings in queries. 
                // "i" - Case insensitivity to match both upper and lower cases. 
            }

            if (category) {
                query.category = { $regex: category, $options: "i" };
            }

            if (brand) {
                query.brand = brand; //we use dropdown search in UI.
            }

            const sortOption = sort === 'asc' ? 1 : -1

            //pagination
            const pageNumber = Number(page);
            const limiNumber = parseInt(limit);

            const products = await productCollection
                .find(query)
                .skip((pageNumber - 1) * limiNumber)
                .limit(limiNumber)
                .sort({ price: sortOption })
                .toArray();

            const totalProducts = await productCollection.countDocuments(query)

            const productInfo = await productCollection
                .find({}, { projection: { category: 1, brand: 1 } })
                .toArray();

            const brands = [...new Set(productInfo.map(product => product.brand))];
            const categories = [...new Set(productInfo.map(product => product.category))];

            //NOTE: The purpose of [..., new Set()] is to create a new array of unique elements.
            //1. new Set() to remove duplicates from an array or obj.
            //2. the spread operator (...) to convert the Set() back into an array.
            //3. {}--> empty array is used to query from all products collection.

            res.json({ products, brands, categories, totalProducts });
        })

        // post product 
        app.post('/add-porduct', verifyJWT, verifySeller, async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })

        // get user 
        app.get('/user/:email', async (req, res) => {
            const query = { email: req.params.email };
            const user = await userCollection.findOne(query);
            res.send(user);
        })

        // insert user
        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "user alreay exist" }, { status: 304 });
            }

            const result = await userCollection.insertOne(user);
            res.send(result, { message: "Successfully! user account created." }, { status: 200 });
        })

    } catch (error) {
        console.log(error.name, error.message);
    }
};

dbConnect();

// create jwt 
app.post('/authentication', async (req, res) => {
    const userEmail = req.body;
    const token = jwt.sign(userEmail, process.env.ACCESS_KEY_TOKEN, { expiresIn: '10d' });
    res.send({ token });
})

// api 
app.get("/", (req, res) => {
    res.send("server is runnig>>>>>>>>>>>>>>>")
})


app.listen(port, () => {
    console.log(`gadget shop is running on port ${port}`);
})