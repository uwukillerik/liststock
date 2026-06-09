import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
        <Card className="p-8 text-center max-w-md">
          <div className="text-5xl font-bold text-primary mb-4">404</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Страница не найдена
          </h1>
          <p className="text-muted-foreground mb-6">
            К сожалению, запрашиваемая страница не существует
          </p>
          <Link to="/">
            <Button className="gap-2">
              <Home className="h-4 w-4" />
              Вернуться на главную
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
};

export default NotFound;
