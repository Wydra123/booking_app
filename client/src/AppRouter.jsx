import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./Login";
import AppMain from "./App";

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppMain />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;