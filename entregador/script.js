const PIX_KEY="57293143000156";const API_URL="https://script.google.com/macros/s/AKfycbyqeugeCr2xhK96ucylAez0-zpS1zJ1vzEb3qRVuA4rNEiGa6iTcwVTrkTF3Qr6RrGQ/exec";

let openDeliveryDetails=JSON.parse(localStorage.getItem("pegaleva_open_delivery_details")||"[]"),session=JSON.parse(localStorage.getItem("pegaleva_driver")||"null"),chatDeliveryId="",lastAvailableIds=JSON.parse(localStorage.getItem("pegaleva_seen_deliveries")||"[]"),finalizedShown=JSON.parse(localStorage.getItem("pegaleva_finalized_driver")||"[]"),showAllDriverDeliveries=false,showAllHistory=false
