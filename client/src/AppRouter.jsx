import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App";
import Navbar from "./Navbar";
import Login from "./Login";
import Register from "./Register";
import MyServices from "./MyServices";
import ServiceDetails from "./ServiceDetails";

function AppRouter() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/my-services" element={<MyServices />} />
        <Route path="/service/:id" element={<ServiceDetails />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;