using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karna.Infrastructure.Persistence._Data.Migrations
{
    /// <inheritdoc />
    public partial class AddListingsColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No-op: All columns (Location, Price, FairPrice, NegotiationRangeLower,
            // NegotiationRangeUpper, ConfidenceLevel, ModelVersion, PredictedAt)
            // already exist in the database from previous migrations.
            // This migration exists only to re-sync the EF model snapshot.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No-op: matching the empty Up method.
        }
    }
}
