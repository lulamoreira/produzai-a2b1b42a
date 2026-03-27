import { Navigate } from "react-router-dom";

// Chat is now campaign-scoped, redirect to home
const Chat = () => <Navigate to="/" replace />;
export default Chat;
