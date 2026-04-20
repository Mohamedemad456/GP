using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karna.Infrastructure.Persistence._Data.Migrations
{
    /// <inheritdoc />
    public partial class AddListingDefects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ListingDefects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ListingId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConditionDefectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingDefects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingDefects_ConditionDefects_ConditionDefectId",
                        column: x => x.ConditionDefectId,
                        principalTable: "ConditionDefects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ListingDefects_Listings_ListingId",
                        column: x => x.ListingId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListingDefects_ConditionDefectId",
                table: "ListingDefects",
                column: "ConditionDefectId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingDefects_ListingId",
                table: "ListingDefects",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingDefects_ListingId_ConditionDefectId",
                table: "ListingDefects",
                columns: new[] { "ListingId", "ConditionDefectId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListingDefects");
        }
    }
}
