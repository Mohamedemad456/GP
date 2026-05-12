using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karna.Infrastructure.Persistence._Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminActivityLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "Listings",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedByAdminId",
                table: "Listings",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AdminActivityLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AdminId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Details = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    PerformedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminActivityLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AdminActivityLogs_Users_AdminId",
                        column: x => x.AdminId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Listings_ApprovedByAdminId",
                table: "Listings",
                column: "ApprovedByAdminId");

            migrationBuilder.CreateIndex(
                name: "IX_AdminActivityLogs_AdminId",
                table: "AdminActivityLogs",
                column: "AdminId");

            migrationBuilder.CreateIndex(
                name: "IX_AdminActivityLogs_PerformedAt",
                table: "AdminActivityLogs",
                column: "PerformedAt");

            migrationBuilder.AddForeignKey(
                name: "FK_Listings_Users_ApprovedByAdminId",
                table: "Listings",
                column: "ApprovedByAdminId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Listings_Users_ApprovedByAdminId",
                table: "Listings");

            migrationBuilder.DropTable(
                name: "AdminActivityLogs");

            migrationBuilder.DropIndex(
                name: "IX_Listings_ApprovedByAdminId",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "ApprovedByAdminId",
                table: "Listings");
        }
    }
}
