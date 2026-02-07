import React, { useState } from 'react';
import { Tooltip } from '@mui/material';

interface MoneyDisplayProps {
  amount: number;
  currency: string;
  rate: number;
}

const MoneyDisplay: React.FC<MoneyDisplayProps> = ({ amount, currency, rate }) => {
    const [showConverted, setShowConverted] = useState(false);
    
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click events if in a table
        setShowConverted(!showConverted);
    };

    const displayAmount = showConverted 
        ? (currency === 'USD' ? amount * rate : amount / rate) 
        : amount;
    
    const displayCurrency = showConverted
        ? (currency === 'USD' ? 'CDF' : 'USD')
        : currency;

    return (
        <Tooltip title={`Cliquez pour convertir (${rate} CDF/USD)`}>
            <span 
                onClick={handleClick} 
                style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', fontWeight: 'bold', color: showConverted ? '#1976d2' : 'inherit' }}
            >
                {displayAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {displayCurrency}
            </span>
        </Tooltip>
    );
};

export default MoneyDisplay;