"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function EquipmentPage() {
  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="page-title">Equipment</h1>
        <p className="page-description">Additional goods and equipment for your booth</p>
      </div>
      <Card className="card-elevated">
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: "hsl(209 65% 21% / 0.07)" }}>
            <ShoppingCart className="h-7 w-7" style={{ color: "hsl(209 65% 38%)" }} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Equipment catalogue</p>
            <p className="text-sm text-muted-foreground mt-1">Coming soon — additional goods will be available here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
