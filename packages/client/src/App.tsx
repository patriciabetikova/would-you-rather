import { Route, Routes } from "react-router-dom";
import { RoomPage } from "./pages/RoomPage";
import { HomePage } from "./pages/HomePage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/room/:code" element={<RoomPage />} />
    </Routes>
  );
}

export default App;
