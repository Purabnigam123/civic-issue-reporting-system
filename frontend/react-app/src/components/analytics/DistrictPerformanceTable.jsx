import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';

export const DistrictPerformanceTable = ({ data = [], title = 'District Performance' }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>District</TableHead>
              <TableHead>Active Issues</TableHead>
              <TableHead>Resolution Rate</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((district) => (
                <TableRow key={district.id}>
                  <TableCell className="font-medium">{district.name}</TableCell>
                  <TableCell>{district.activeIssues}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={district.resolutionRate} max={100} className="w-[60px]" />
                      <span className="text-xs text-slate-500">{district.resolutionRate}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={district.resolutionRate >= 80 ? 'success' : district.resolutionRate >= 50 ? 'warning' : 'danger'}>
                      {district.resolutionRate >= 80 ? 'Good' : district.resolutionRate >= 50 ? 'Average' : 'Poor'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500 py-4">
                  No data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
