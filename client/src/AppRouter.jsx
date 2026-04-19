import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App";
import Navbar from "./Navbar";
import Login from "./Login";
import Register from "./Register";
import MyServices from "./MyServices";
import ServiceDetails from "./ServiceDetails";
import MyAppointments from "./MyAppointments";
import Profile from "./Profile";

// Główny router aplikacji — definiuje wszystkie ścieżki i renderuje Navbar nad każdą stroną
function AppRouter() {
  return (
    <BrowserRouter>
      {/* Navbar jest poza Routes, więc pojawia się na każdej podstronie */}
      <Navbar />
      <Routes>
        {/* Strona główna — lista wszystkich usług */}
        <Route path="/" element={<App />} />

        {/* Autoryzacja */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Panel usługodawcy — zarządzanie własnymi usługami */}
        <Route path="/my-services" element={<MyServices />} />

        {/* Szczegóły konkretnej usługi z możliwością rezerwacji */}
        <Route path="/service/:id" element={<ServiceDetails />} />

        {/* Lista rezerwacji zalogowanego użytkownika */}
        <Route path="/my-appointments" element={<MyAppointments />} />

        {/* Profil użytkownika — dane osobowe */}
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
