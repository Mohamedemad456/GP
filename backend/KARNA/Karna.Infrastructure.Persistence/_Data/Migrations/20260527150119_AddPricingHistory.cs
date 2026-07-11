using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karna.Infrastructure.Persistence._Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPricingHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PricingHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ListingId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OldPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    NewPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    OldFairPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    NewFairPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    ChangeReason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ChangedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PricingHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PricingHistories_Listings_ListingId",
                        column: x => x.ListingId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PricingHistories_Users_ChangedByUserId",
                        column: x => x.ChangedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PricingHistories_ChangedAt",
                table: "PricingHistories",
                column: "ChangedAt");

            migrationBuilder.CreateIndex(
                name: "IX_PricingHistories_ChangedByUserId",
                table: "PricingHistories",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PricingHistories_ListingId",
                table: "PricingHistories",
                column: "ListingId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PricingHistories");
        }
    }
}
