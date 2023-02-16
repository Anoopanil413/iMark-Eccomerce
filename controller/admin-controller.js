const admin = require('../model/myadmin')
const user = require('../model/user')
const product = require('../model/product')
const category = require('../model/categories');
const Order = require('../model/order')
const banner = require('../model/banner')
const puppeteer = require('puppeteer');
const XLSX = require('xlsx');





const getAdmin = (req, res) => {
    res.render('admin-signin')
}
const adminLogout = (req, res) => {
    console.log(req.session.adminId)
    req.session.adminId = null;
    res.render('admin-signin')
}
const getAdminHome = async(req, res) => {
    if (req.session.adminId) {
        let users = await user.find()
        let userCount = users.length
        let products = await product.find()
        let productCount  = products.length
        res.render('admin-home',{userCount,productCount})
    } else {
        res.render('admin-signin')
    }

}
const adminUsers = async (req, res, next) => {
    try {
        const userData = await user.find({})
        res.render('admin-user', {user: userData})
    } catch (error) {
        return res.status(500).send(error)
    }
}

const getProducts = async (req, res) => {
    try {
        const proData = await product.find({})
        if (proData.length != 0) {
            proData.forEach((product, index, array) => {
                array[index].images = product.images.splice(0, 1);
            })
            res.render('admin-product', {product: proData})
        } else {
            res.render('admin-product', {product: proData})
        }

    } catch (error) {
        return res.status(500).send(error)
    }
}

const updateBanner = async (req,res)=>{
    try {
        res.render('addBanner')
    } catch (error) {
        console.log(error)
    }
}

const getAddProducts = async (req, res) => {
    try {
        const catData = await category.find({})
        let message = req.session.message
        req.session.message = null
        res.render('admin-addProducts', {category: catData,message})

    } catch (error) {
        return res.status(500).send(error)
    }
}
const getEditProducts = async (req, res) => {
    try {
        const id = req.params.id;

        const prodData = await product.find({_id: id}).populate('category');
        const Category = await category.find({});
        // console.log(prodData.populate("category"));
        let images = prodData[0].images
        let objects = [];
        for (let i = 0; i < prodData[0].images.length; i++) {
            objects[i] = {
                image: images[i],
            };
        }

        let data = {
            objects: objects
        };
        console.log(123, Category)
        res.render('updateproduct', {
            prodData: prodData[0],
            Category,
            objects
        });
    } catch (error) {
        return res.status(500).send(error)
    }
}




// post
const adminLogin = async (req, res) => {

    console.log(req.body)
    let adminUser = new admin(req.body)
    console.log(adminUser)
    const admindata = await admin.find({email: req.body.email})
    console.log(admindata)
    if (admindata != 0) {
        req.session.adminId = admindata[0]._id;
        let pass = admindata[0].password
        if (req.body.password === pass) {
            res.redirect('/admin/admin-home')
        } else {
            return res.render('admin-signin', {errMessage: `Invalid Password`})
        }
    } else {
        res.render('admin-signin', {errMessage: `Invalid Credentials`})
    }
}

// Block user

const blockUser = async (req, res) => {
    console.log("Blocking user")
    const id = req.params._id
    const User = await user.findById(id)
    if (User.Action) {
        try {
            await user.findOneAndUpdate({
                _id: id
            }, {
                $set: {
                    Action: false
                }
            })
            req.session.userId = null
            return res.json({redirect: "http://localhost:4000/admin/users"})
        } catch (error) {
            console.log(error)
        }
    } else {
        try {
            const User = await user.findOneAndUpdate({
                _id: id
            }, {
                $set: {
                    Action: true
                }
            })
            return res.json({redirect: "http://localhost:4000/admin/users"})
        } catch (error) {}
    }
}
const getOrderDetails = async(req,res)=>{
    try {
        const productSale = await Order.aggregate(
            [
                {
                    $match:{
                        isCancelled:false
                    }
                },
                {
                    $group:{
                        _id:{$dayOfYear: '$createdAt'},
                        date: {$first: '$createdAt'},
                        totalAmount:{
                            $sum:'$totalAmount'
                        }
                    }
                },
                {
                  $sort: {
                    date: 1
                  }
                }
            ]
    
        )
        return res.json({ productSale: productSale })
    } catch (error) {
        console.log(error)
    }

}
const getProductData = async(req,res)=>{
    try {
        let productData = await Order.aggregate(
            [
                {
                    '$match': {
                        'isCancelled': false
                      }
                },
                {
                $lookup:
                {
                    from: "products",
                    localField: "orderItems.proId",
                    foreignField: "_id",
                    as: "product_info"
                }
                },
                {
                    $unwind:{
                        path:"$product_info"
                    } 
                 },
                 {
                    $group:
                    {
                       _id: "$orderItems.proId",
                       product_name: { $first: "$product_info.name" },
                       total_orders: { $sum: 1 }
                    }
                 },
                 {
                    $sort: { total_orders: -1 }
                 }
            ]
        )
        return res.json(productData)
    } catch (error) {
        console.log(error)
    }
}

//edit banner
const editBanner = async(req,res)=>{
    const banners = await banner.find()
    console.log(banners)
    const images = req.files.map(file => file.filename);
    const caption = req.body.caption;
    if(!banners){
        let bannerModel = new banner({ caption: caption,images: images });
        await bannerModel.save()
        res.redirect('/admin/admin-home')
    }else{
        await banner.deleteMany()
        let bannerModel = new banner({ caption: caption,images: images });
        await bannerModel.save()
        res.redirect('/admin/admin-home')

    }


}

//pdf html page
const getSalesReport = async (req,res)=>{
    try {
        let orderPerDay = await Order.aggregate(
            [
                {
                    $match:{
                        isCancelled:false
                    }
                },
                {
                    $group:{
                        _id:{$dayOfYear: '$createdAt'},
                        date: {$first: '$createdAt'},
                        totalAmount:{
                            $sum:'$totalAmount'
                        }
                    }
                },
                {
                  $sort: {
                    date: 1
                  }
                }
            ]
        )
        res.render('sales-report',{order:orderPerDay})

    } catch (error) {
        console.log(error)
    }
}

//puppeteer configuration to download pdf
const downloadReport = async (req,res)=>{
    try {
        // Create a browser instance
const browser = await puppeteer.launch();

// Create a new page
const page = await browser.newPage();

// Website URL to export as pdf
const website_url = 'http://localhost:4000/admin/getSalesReport';

// Open URL in current page
await page.goto(website_url, { waitUntil: 'networkidle0' });
//To reflect CSS used for screens instead of print
await page.emulateMediaType('screen');

// Downlaod the PDF
const pdf = await page.pdf({
    path: 'result.pdf',
    margin: { top: '100px', right: '50px', bottom: '100px', left: '50px' },
    printBackground: true,
    format: 'A4',
  });

  res.download('result.pdf')
  // Close the browser instance
await browser.close();

        
    } catch (error) {
        console.log(error)
    }
}
//puppeteer configuration to download pdf

const downloadProductReport = async (req,res)=>{
    try {
                // Create a browser instance
const browser = await puppeteer.launch();

// Create a new page
const page = await browser.newPage();

// Website URL to export as pdf
const website_url = 'http://localhost:4000/admin/getProductSalesReport';

// Open URL in current page
await page.goto(website_url, { waitUntil: 'networkidle0' });
//To reflect CSS used for screens instead of print
await page.emulateMediaType('screen');

// Downlaod the PDF
const pdf = await page.pdf({
    path: 'result.pdf',
    margin: { top: '100px', right: '50px', bottom: '100px', left: '50px' },
    printBackground: true,
    format: 'A4',
  });

  res.download('result.pdf')
  // Close the browser instance
await browser.close();
        
    } catch (error) {
        console.log(error)
    }
}
//pdf html page

const getProductSalesReport = async (req,res)=>{
    try {
        let productData = await Order.aggregate(
            [
                {
                    '$match': {
                        'isCancelled': false
                      }
                },
                {
                $lookup:
                {
                    from: "products",
                    localField: "orderItems.proId",
                    foreignField: "_id",
                    as: "product_info"
                }
                },
                {
                    $unwind:{
                        path:"$product_info"
                    } 
                 },
                 {
                    $group:
                    {
                       _id: "$orderItems.proId",
                       product_name: { $first: "$product_info.name" },
                       total_orders: { $sum: 1 }
                    }
                 },
                 {
                    $sort: { total_orders: -1 }
                 }
            ]
        )
        console.log(productData)
        res.render('productSales-report',{productData})
        
    } catch (error) {
        console.log(error)
        
    }
    
}


//excel product sale report
const downloadProductSalesExcel = async (req,res)=>{
    try {
        let productData = await Order.aggregate(
            [
                {
                    '$match': {
                        'isCancelled': false
                      }
                },
                {
                $lookup:
                {
                    from: "products",
                    localField: "orderItems.proId",
                    foreignField: "_id",
                    as: "product_info"
                }
                },
                {
                    $unwind:{
                        path:"$product_info"
                    } 
                 },
                 {

                    $lookup:{
                        from:"categories",
                        localField: "product_info.category",
                        foreignField: "_id",
                        as: "result"
                      }

                 },
                 {
                    $unwind:{
                        path:"$result"
                    }

                 },
                 {
                    $group:
                    {
                       _id: "$orderItems.proId",
                       product_name: { $first: "$product_info.name" },
                       total_orders: { $sum: 1 },
                       product_category:{$first:"$result.name"},                     
                       
                    }
                 },
                 {
                    $sort: { total_orders: -1 }
                 }
            ]
        )        
      const workSheet = XLSX.utils.json_to_sheet(productData);
      const workBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workBook, workSheet, 'Product wise sheet');
      XLSX.writeFile(workBook, 'sampleproduct.xlsx');

      res.download('sampleproduct.xlsx')

    } catch (error) {
        console.log(error)
        
    }



}


const downloadPerdaySalesExcel = async (req,res)=>{
    try {
        let orderPerDay = await Order.aggregate(
            [
                {
                    $match:{
                        isCancelled:false
                    }
                },
                {
                    $group:{
                        _id:{$dayOfYear: '$createdAt'},
                        date: {$first: '$createdAt'},
                        totalAmount:{
                            $sum:'$totalAmount'
                        }
                    }
                },
                {
                  $sort: {
                    date: 1
                  }
                }
            ]
        )
        const workSheet = XLSX.utils.json_to_sheet(orderPerDay);
        const workBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workBook, workSheet, 'Product wise sheet');
        XLSX.writeFile(workBook, 'sampleproduct.xlsx');
  
        res.download('sampleproduct.xlsx')

        
    } catch (error) {
        
    }
}

//order details
const orderDetails = async(req,res)=>{
    try {
        let orderDetails = await Order.find({isCancelled:false}).populate('user')        
        res.render('admin_orderDetails',{order:orderDetails})     
    } catch (error) {
        console.log(error)
        
    }
}

//deliver order
const deliverOrder = async (req,res)=>{
    try {
        let id = req.params._id
        let order = await Order.findOneAndUpdate({_id:id},{$set:{'isDelivered':true,'deliveredAt':Date.now()}})
        res.json({redirect:"/admin/orderDetails"})

    } catch (error) {
        console.log(error)
    }

}

//category offer

const categoryOffer = async (req,res)=>{
    try {
        let id = req.params._id
        let Category = await category.find({_id:id})

        res.render('categoryOffer',{cat:Category})
    } catch (error) {
        console.log(error)
        
    }
}

const applyCatoffer = async (req,res)=>{
    try {
        let id = req.params._id
        let Cname = req.body.name
        let Offer =req.body.offer
        console.log(Cname,Offer)
        let catoffer = await category.findOneAndUpdate({name:Cname},{$set:{offer:Offer}})
        let Products = await product.find({category:id})
        Products.forEach((item)=>{
            item.Poffer = item.price*(1-(Offer/100))
            item.save()
        })
        console.log(Products)
        res.redirect('/admin/category')

    } catch (error) {
        console.log(error)
    }
}

//view order
const viewOrder =async (req,res)=>{
    try {
        let id = req.params._id
        let order = await Order.aggregate(
            [

            ]
        )
        
    } catch (error) {
        
    }
}

//approve return order
 const approveReturnOrder = async(req,res)=>{
    try {
        let id = req.params._id
        console.log(id)
        let order = await Order.findOneAndUpdate({_id:id},{$set:{'returned':true}})
        console.log(order);
        let orderQuant = order.orderItems[0]
        let quant = []
        for(let i = 0; i<order.orderItems.length;i++){
            quant.push = order.orderItems[i].quantity;
        }
        console.log(quant)
        

    } catch (error) {
        console.log(error)
    }
 }





module.exports = {
    getAdmin,
    adminLogin,
    adminLogout,
    adminUsers,
    getAdminHome,
    getProducts,
    getAddProducts,
    blockUser,
    getEditProducts,
    updateBanner,
    getOrderDetails,
    getProductData,
    editBanner,
    getSalesReport,
    downloadReport,
    downloadProductReport,
    getProductSalesReport,
    downloadProductSalesExcel,
    downloadPerdaySalesExcel,
    orderDetails,
    deliverOrder,
    categoryOffer,
    applyCatoffer,
    viewOrder,
    approveReturnOrder
    
    
}
