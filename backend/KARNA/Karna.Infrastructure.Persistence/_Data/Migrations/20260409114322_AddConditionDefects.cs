using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karna.Infrastructure.Persistence._Data.Migrations
{
    /// <inheritdoc />
    public partial class AddConditionDefects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConditionDefects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ItemNameAr = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DescriptionAr = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConditionDefects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConditionDefects_ConditionChecklistCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "ConditionChecklistCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConditionDefects_CategoryId_ItemName",
                table: "ConditionDefects",
                columns: new[] { "CategoryId", "ItemName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConditionDefects_CategoryId_ItemNameAr",
                table: "ConditionDefects",
                columns: new[] { "CategoryId", "ItemNameAr" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConditionDefects");
        }
    }
}
