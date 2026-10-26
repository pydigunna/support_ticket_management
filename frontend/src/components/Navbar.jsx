
import { NavLink } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="brand">TicketDesk</div>

      <div className="nav-links">
        <NavLink to="/" end>
          Dashboard
        </NavLink>

        <NavLink to="/tickets">
          Tickets
        </NavLink>
      </div>
    </nav>
  );
}

export default Navbar;
